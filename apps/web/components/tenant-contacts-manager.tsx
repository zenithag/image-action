"use client"

import { Modal } from "@/components/spectrum/modal"
import styles from "./management-layout.module.css"
import { PageHeader } from "@/components/organisms/page-header"
import { Input, Textarea } from "@/components/spectrum/fields"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Filter, Loader2, Plus, UserRound, X } from "@/components/spectrum/icons"

import { Button } from "@/components/ui/button"
import type { CompositionJob } from "@/lib/composition-types"
import type { TenantContact, TenantContactInput } from "@/lib/contact-types"
import { cn } from "@/lib/utils"

const TAG_COLORS = [
  "bg-primary/10 text-primary border-primary/20",
  "bg-info/10 text-info border-info/20",
  "bg-violet-500/10 text-violet-600 border-violet-500/20",
  "bg-warning/10 text-warning border-warning/20",
  "bg-danger/10 text-danger border-danger/20",
  "bg-info/10 text-info border-info/20",
]

function tagColor(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

type ContactForm = {
  name: string
  phone: string
  email: string
  company: string
  tags: string
  notes: string
}

type TenantContactsManagerProps = {
  tenantSlug: string
}

type CompositionJobsResponse = {
  jobs: CompositionJob[]
}

const emptyForm: ContactForm = {
  name: "",
  phone: "",
  email: "",
  company: "",
  tags: "",
  notes: "",
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisicao invalida."
    throw new Error(message)
  }

  return payload as T
}

function formatDate(value?: string) {
  if (!value) return "Sem contato"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formFromContact(contact: TenantContact): ContactForm {
  return {
    name: contact.name,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    company: contact.company ?? "",
    tags: contact.tags.join(", "),
    notes: contact.notes ?? "",
  }
}

function payloadFromForm(form: ContactForm): TenantContactInput {
  return {
    name: form.name,
    phone: form.phone,
    email: form.email,
    company: form.company,
    tags: form.tags,
    notes: form.notes,
  }
}

function normalizePhone(value?: string) {
  return (value || "").replace(/\D/g, "")
}

function contactMatchesJob(contact: TenantContact, job: CompositionJob) {
  const contactPhone = normalizePhone(contact.phone || contact.externalContactId)
  const jobPhone = normalizePhone(job.contactPhone)

  if (contactPhone && jobPhone && (contactPhone.endsWith(jobPhone) || jobPhone.endsWith(contactPhone))) {
    return true
  }

  return contact.name.trim().toLowerCase() === job.contactName.trim().toLowerCase()
}

export function TenantContactsManager({ tenantSlug }: TenantContactsManagerProps) {
  const [contacts, setContacts] = useState<TenantContact[]>([])
  const [compositionJobs, setCompositionJobs] = useState<CompositionJob[]>([])
  const [query, setQuery] = useState("")
  const [selectedContact, setSelectedContact] = useState<TenantContact | null>(null)
  const [editingContact, setEditingContact] = useState<TenantContact | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadContacts() {
    setIsLoading(true)
    setError(null)

    try {
      const data = await requestJson<TenantContact[]>(`/api/tenant/${tenantSlug}/contacts`, { cache: "no-store" })
      setContacts(data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar contatos.")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadCompositionJobs() {
    try {
      const data = await requestJson<CompositionJobsResponse>(`/api/tenant/${tenantSlug}/compositions/jobs`, { cache: "no-store" })
      setCompositionJobs(data.jobs)
    } catch {
      setCompositionJobs([])
    }
  }

  useEffect(() => {
    void loadContacts()
    void loadCompositionJobs()
  }, [tenantSlug])

  const filteredContacts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) return contacts

    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(normalizedQuery) ||
      contact.phone?.toLowerCase().includes(normalizedQuery) ||
      contact.email?.toLowerCase().includes(normalizedQuery) ||
      contact.company?.toLowerCase().includes(normalizedQuery) ||
      contact.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
    )
  }, [contacts, query])

  const selectedContactJobs = useMemo(() => {
    if (!selectedContact) return []

    return compositionJobs
      .filter((job) => contactMatchesJob(selectedContact, job))
      .slice(0, 5)
  }, [compositionJobs, selectedContact])

  function openCreate() {
    setEditingContact(null)
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  function openEdit(contact: TenantContact) {
    setEditingContact(contact)
    setForm(formFromContact(contact))
    setIsFormOpen(true)
  }

  async function saveContact() {
    if (isSaving) return

    setIsSaving(true)
    setError(null)

    try {
      if (editingContact) {
        if (editingContact.source === "inbox") {
          const created = await requestJson<TenantContact>(`/api/tenant/${tenantSlug}/contacts`, {
            method: "POST",
            body: JSON.stringify({
              ...payloadFromForm(form),
              externalContactId: editingContact.externalContactId,
            }),
          })
          setContacts((current) => [created, ...current.filter((contact) => contact.id !== editingContact.id)])
          setSelectedContact(created)
        } else {
          const updated = await requestJson<TenantContact>(
            `/api/tenant/${tenantSlug}/contacts/${encodeURIComponent(editingContact.id)}`,
            {
              method: "PATCH",
              body: JSON.stringify(payloadFromForm(form)),
            }
          )
          setContacts((current) => current.map((contact) => contact.id === updated.id ? updated : contact))
          setSelectedContact((current) => current?.id === updated.id ? updated : current)
        }
      } else {
        const created = await requestJson<TenantContact>(`/api/tenant/${tenantSlug}/contacts`, {
          method: "POST",
          body: JSON.stringify(payloadFromForm(form)),
        })
        setContacts((current) => [created, ...current])
        setSelectedContact(created)
      }

      setIsFormOpen(false)
      setEditingContact(null)
      setForm(emptyForm)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar contato.")
    } finally {
      setIsSaving(false)
    }
  }

  async function removeContact(contact: TenantContact) {
    if (contact.source === "inbox") {
      setError("Contatos originados do inbox reaparecem enquanto houver conversa. Cadastre um contato manual para gerir dados adicionais.")
      return
    }

    if (!window.confirm(`Excluir ${contact.name}?`)) return

    setError(null)

    try {
      await requestJson<{ ok: true }>(`/api/tenant/${tenantSlug}/contacts/${encodeURIComponent(contact.id)}`, {
        method: "DELETE",
      })
      setContacts((current) => current.filter((item) => item.id !== contact.id))
      if (selectedContact?.id === contact.id) setSelectedContact(null)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir contato.")
    }
  }

  return (
    <div className={cn(styles.page, styles.contactsPage)}>
      <PageHeader
        className={styles.header}
        title="Contatos"
        subtitle={`CRM · ${filteredContacts.length} registros`}
        search={{ value: query, onChange: setQuery, label: "Buscar contatos", placeholder: "Buscar contatos por nome, telefone ou empresa..." }}
        actions={
          <Button onClick={openCreate}>
            <span className={styles.actionLabel}><Plus className="h-4 w-4" />Novo contato</span>
          </Button>
        }
      />

      <div className={styles.contactsContent}>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 pb-3">
            <Button variant="outline" type="button">
              <span className={styles.actionLabel}><Filter className="h-4 w-4" />Filtros</span>
            </Button>
            <span className="ml-auto text-sm text-muted-foreground">{filteredContacts.length} {filteredContacts.length === 1 ? "contato" : "contatos"}</span>
          </div>

          {error && (
            <div className="border-b border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink dark:border-danger/40 dark:bg-danger/30 dark:text-danger">
              {error}
            </div>
          )}

          <div className={styles.tablePanel}>
            {isLoading ? (
              <div className="flex h-full items-center justify-center p-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando contatos...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className={styles.empty}>
                <UserRound className="mb-3 h-10 w-10 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold text-foreground">Nenhum contato encontrado</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Crie contatos manualmente ou receba mensagens no inbox para alimentar esta listagem.
                </p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className={cn("w-10 px-4 py-3", styles.contactSelection)}><Input type="checkbox" className="rounded-md border-border" /></th>
                    <th className="px-4 py-3">Contato</th>
                    <th className={cn("px-4 py-3", styles.contactCompany)}>Cidade</th>
                    <th className={cn("px-4 py-3", styles.contactConversations)}>Conversas</th>
                    <th className={cn("px-4 py-3", styles.contactLastSeen)}>Último contato</th>
                    <th className={cn("px-4 py-3", styles.contactTags)}>Tag</th>
                    <th className={cn("px-4 py-3", styles.contactAction)}><span className="sr-only">Abrir contato</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className={cn(
                        "transition-colors hover:bg-muted/40",
                        selectedContact?.id === contact.id && "bg-primary/5"
                      )}
                    >
                      <td className={cn("px-4 py-3", styles.contactSelection)}><Input type="checkbox" className="rounded-md border-border" /></td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                            {contact.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{contact.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{contact.phone || "Sem telefone"}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 truncate text-sm text-muted-foreground", styles.contactCompany)}>{contact.company || "—"}</td>
                      <td className={cn("px-4 py-3 text-sm", styles.contactConversations)}>{contact.conversationsCount}</td>
                      <td className={cn("px-4 py-3 text-sm text-muted-foreground", styles.contactLastSeen)}>{formatDate(contact.lastContactAt)}</td>
                      <td className={cn("px-4 py-3", styles.contactTags)}>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", tagColor(tag))}>{tag}</span>
                          ))}
                          {contact.tags.length > 2 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{contact.tags.length - 2}</span>
                          )}
                          {contact.tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 text-right", styles.contactAction)}>
                        <Button variant="ghost" type="button" className={styles.contactOpen} aria-label={`Abrir contato ${contact.name}`} title={`Abrir contato ${contact.name}`}
                          onClick={() => setSelectedContact(contact)}>
                          <span className={styles.contactOpenLabel}>Abrir</span><ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {selectedContact && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-[420px] max-w-full flex-col pb-[72px] md:pb-0 border-l border-border bg-card animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-lg font-bold text-foreground">{selectedContact.name}</h2>
            <Button variant="ghost" size="icon" type="button" aria-label="Fechar detalhes do contato" onClick={() => setSelectedContact(null)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex flex-col items-center gap-3 pb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
                {selectedContact.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="text-center">
                <p className="font-display text-lg font-bold text-foreground">{selectedContact.name}</p>
                <p className="text-sm text-muted-foreground">{selectedContact.phone || "Sem telefone"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-background p-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Informações</h4>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="text-foreground">{selectedContact.email || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Empresa</span><span className="text-foreground">{selectedContact.company || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Conversas</span><span className="text-foreground">{selectedContact.conversationsCount}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Último contato</span><span className="text-foreground">{formatDate(selectedContact.lastContactAt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Origem</span><span className="text-foreground">{selectedContact.source === "inbox" ? "Inbox" : "Manual"}</span></div>
                </div>
              </div>
              {selectedContact.tags.length > 0 && (
                <div className="rounded-md border border-border bg-background p-4">
                  <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedContact.tags.map((tag) => (
                      <span key={tag} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", tagColor(tag))}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedContact.notes && (
                <div className="rounded-md border border-border bg-background p-4">
                  <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Notas</h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">{selectedContact.notes}</p>
                </div>
              )}
              <div className="rounded-md border border-border bg-background p-4">
                <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Composições</h4>
                {selectedContactJobs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedContactJobs.map((job) => (
                      <div key={job.id} className="rounded-lg border border-border bg-card px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-foreground">{job.catalogItemName || job.prompt}</span>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase text-muted-foreground">{job.status}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(job.createdAt)} · {job.id.slice(0, 8)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma composição vinculada a este contato ainda.</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 border-t border-border p-4">
            <Button variant="outline" className="flex-1" onClick={() => openEdit(selectedContact)}>Editar</Button>
            <Button variant="outline" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeContact(selectedContact)}>Excluir</Button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <Modal className="w-full max-w-2xl" onClose={() => setIsFormOpen(false)}>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {editingContact ? "Editar contato" : "Novo contato"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Dados persistidos para este tenant.</p>
              </div>
              <Button variant="ghost" size="icon" type="button" 
                onClick={() => setIsFormOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nome</span>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</span>
                <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email</span>
                <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Empresa</span>
                <Input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tags</span>
                <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="cliente, loja, prioridade" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notas</span>
                <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-5">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button onClick={saveContact} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          
        </Modal>
      )}
    </div>
  )
}
