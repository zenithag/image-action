"use client"

import { useEffect, useMemo, useState } from "react"
import { Edit, Loader2, MessageSquare, Plus, Search, Trash2, UserRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TenantContact, TenantContactInput } from "@/lib/contact-types"
import { cn } from "@/lib/utils"

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

export function TenantContactsManager({ tenantSlug }: TenantContactsManagerProps) {
  const [contacts, setContacts] = useState<TenantContact[]>([])
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

  useEffect(() => {
    void loadContacts()
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

  function openCreate() {
    setEditingContact(null)
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  function openEdit(contact: TenantContact) {
    if (contact.source === "inbox") {
      setError("Contatos gerados pelo inbox devem ser cadastrados manualmente antes de editar.")
      return
    }

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
        const updated = await requestJson<TenantContact>(
          `/api/tenant/${tenantSlug}/contacts/${encodeURIComponent(editingContact.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payloadFromForm(form)),
          }
        )
        setContacts((current) => current.map((contact) => contact.id === updated.id ? updated : contact))
      } else {
        const created = await requestJson<TenantContact>(`/api/tenant/${tenantSlug}/contacts`, {
          method: "POST",
          body: JSON.stringify(payloadFromForm(form)),
        })
        setContacts((current) => [created, ...current])
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Tenant</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">Contatos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Contatos persistidos do tenant e contatos reais detectados nas conversas do inbox.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo contato
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden p-6">
        <section className="flex min-w-0 flex-1 flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nome, telefone, email, empresa ou tags"
                className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
              {filteredContacts.length}
            </span>
          </div>

          {error && (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando contatos...
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <UserRound className="mb-3 h-10 w-10 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold text-foreground">Nenhum contato encontrado</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Crie contatos manualmente ou receba mensagens no inbox para alimentar esta listagem.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedContact(contact)}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_140px_120px] items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/40",
                      selectedContact?.id === contact.id && "bg-primary/5"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-foreground">{contact.name}</p>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          contact.source === "inbox"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}>
                          {contact.source === "inbox" ? "Inbox" : "Manual"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{contact.company || contact.notes || "Sem observacoes"}</p>
                    </div>
                    <div className="min-w-0 text-sm text-muted-foreground">
                      <p className="truncate">{contact.phone || "Sem telefone"}</p>
                      <p className="truncate">{contact.email || "Sem email"}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {contact.conversationsCount} conversa(s)
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(contact.lastContactAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden w-[360px] shrink-0 rounded-xl border border-border bg-card xl:flex xl:flex-col">
          {selectedContact ? (
            <>
              <div className="border-b border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">{selectedContact.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedContact.company || "Sem empresa"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedContact(null)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-5 overflow-auto p-5">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contato</p>
                  <p className="mt-3 text-sm text-foreground">{selectedContact.phone || "Sem telefone"}</p>
                  <p className="mt-1 text-sm text-foreground">{selectedContact.email || "Sem email"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tags</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedContact.tags.length > 0 ? selectedContact.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                        {tag}
                      </span>
                    )) : <span className="text-sm text-muted-foreground">Sem tags</span>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notas</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{selectedContact.notes || "Sem notas cadastradas."}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => openEdit(selectedContact)} disabled={selectedContact.source === "inbox"}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="outline" onClick={() => removeContact(selectedContact)} disabled={selectedContact.source === "inbox"}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <MessageSquare className="mb-3 h-10 w-10" />
              <p className="text-sm">Selecione um contato para ver detalhes.</p>
            </div>
          )}
        </aside>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  {editingContact ? "Editar contato" : "Novo contato"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Dados persistidos para este tenant.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nome</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Telefone</span>
                <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email</span>
                <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Empresa</span>
                <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tags</span>
                <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="cliente, loja, prioridade" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Notas</span>
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border p-5">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button onClick={saveContact} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
