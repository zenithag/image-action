"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { Modal } from "@/components/spectrum/modal"
import { Input, NativeSelect } from "@/components/spectrum/fields"
import { useEffect, useMemo, useState } from "react"
import { Globe, Loader2, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from "@/components/spectrum/icons"

import { Button } from "@/components/ui/button"
import type { SuperadminDomainRecord } from "@/lib/domain-types"
import { cn } from "@/lib/utils"

type DomainCreatePayload = {
  tenantId: string
  domain: string
  isPrimary: boolean
}

type DomainFormState = DomainCreatePayload

const emptyForm: DomainFormState = {
  tenantId: "",
  domain: "",
  isPrimary: false,
}

const statusStyle: Record<SuperadminDomainRecord["status"], string> = {
  active: "bg-success/10 text-success dark:text-success",
  pending: "bg-warning/10 text-warning dark:text-warning",
  default: "bg-secondary text-muted-foreground",
  error: "bg-danger/10 text-danger dark:text-danger",
}

const statusLabel: Record<SuperadminDomainRecord["status"], string> = {
  active: "ativo",
  pending: "pendente",
  default: "padrão",
  error: "erro",
}

const sslLabel: Record<SuperadminDomainRecord["sslStatus"], string> = {
  valid: "válido",
  awaiting: "aguardando",
  managed: "gerenciado",
  invalid: "inválido",
  none: "sem SSL",
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisição inválida."
    throw new Error(message)
  }

  return payload as T
}

function formatSslExpires(value?: string) {
  if (!value) return "—"

  const date = new Date(value)
  const diffInDays = Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (Number.isNaN(diffInDays)) return "—"
  if (diffInDays <= 0) return "expirado"
  if (diffInDays === 1) return "em 1 dia"
  return `em ${diffInDays} dias`
}

function formatCheckedAt(value?: string) {
  if (!value) return "Nunca checado"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<SuperadminDomainRecord[]>([])
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingId, setIsCheckingId] = useState<string | null>(null)
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState<DomainFormState>(emptyForm)

  async function loadDomains() {
    setIsLoading(true)
    setError(null)

    try {
      const payload = await requestJson<SuperadminDomainRecord[]>("/api/superadmin/domains")
      setDomains(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar domínios.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDomains()
  }, [])

  const tenantOptions = useMemo(() => {
    const uniqueTenants = new Map<string, { id: string; name: string; slug: string }>()
    for (const domain of domains) {
      uniqueTenants.set(domain.tenantId, {
        id: domain.tenantId,
        name: domain.tenantName,
        slug: domain.tenantSlug,
      })
    }

    return Array.from(uniqueTenants.values()).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
  }, [domains])

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return domains

    return domains.filter((row) =>
      [
        row.tenantName,
        row.tenantSlug,
        row.domain,
        statusLabel[row.status],
        sslLabel[row.sslStatus],
      ].some((field) => field.toLowerCase().includes(normalizedSearch))
    )
  }, [domains, search])

  async function handleCreate() {
    if (isSaving) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await requestJson<SuperadminDomainRecord>("/api/superadmin/domains", {
        method: "POST",
        body: JSON.stringify(form),
      })
      await loadDomains()
      setForm(emptyForm)
      setIsCreateOpen(false)
      setSuccess("Domínio cadastrado. Rode a checagem para validar DNS e SSL.")
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro ao criar domínio.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCheck(id: string) {
    setIsCheckingId(id)
    setError(null)
    setSuccess(null)

    try {
      const updated = await requestJson<SuperadminDomainRecord>(`/api/superadmin/domains/${encodeURIComponent(id)}/check`, {
        method: "POST",
      })
      setDomains((current) => current.map((domain) => domain.id === updated.id ? updated : domain))
      setSuccess(`Checagem concluída para ${updated.domain}.`)
    } catch (checkError) {
      setError(checkError instanceof Error ? checkError.message : "Erro ao checar domínio.")
    } finally {
      setIsCheckingId(null)
    }
  }

  async function handleDelete(domain: SuperadminDomainRecord) {
    if (domain.isManaged) return
    if (!window.confirm(`Excluir o domínio ${domain.domain}?`)) return

    setIsDeletingId(domain.id)
    setError(null)
    setSuccess(null)

    try {
      await requestJson<{ ok: true }>(`/api/superadmin/domains/${encodeURIComponent(domain.id)}`, {
        method: "DELETE",
      })
      await loadDomains()
      setSuccess(`Domínio ${domain.domain} removido.`)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir domínio.")
    } finally {
      setIsDeletingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-background px-7 py-4">
        <div className="mr-auto">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Infra</p>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">Domínios</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDomains} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Atribuir domínio
          </Button>
        </div>
        <UserMenu />
      </div>

      <div className="flex items-center gap-4 border-b border-border px-7 py-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar domínio ou tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-secondary py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} domínio{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      {error && (
        <div className="border-b border-danger bg-danger-soft px-7 py-3 text-sm font-medium text-danger-ink dark:border-danger/40 dark:bg-danger/30 dark:text-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="border-b border-success bg-success-soft px-7 py-3 text-sm font-medium text-success-ink dark:border-success/40 dark:bg-success/30 dark:text-success">
          {success}
        </div>
      )}

      <div className="flex-1 overflow-auto p-7">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Domínio</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">SSL</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Expira</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Última checagem</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                    Carregando domínios...
                  </td>
                </tr>
              ) : filtered.map((row) => (
                <tr key={row.id} className="border-b border-border/50 transition-colors last:border-b-0 hover:bg-secondary/50">
                  <td className="px-4 py-3.5 text-sm">
                    <p className="font-medium text-foreground">{row.tenantName}</p>
                    <p className="text-xs text-muted-foreground">{row.tenantSlug}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{row.domain}</span>
                      {row.isPrimary && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase tracking-[0.08em] text-primary">
                          principal
                        </span>
                      )}
                    </div>
                    {row.lastError && (
                      <p className="mt-1 text-xs text-danger dark:text-danger">{row.lastError}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyle[row.status])}>
                      {statusLabel[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      {sslLabel[row.sslStatus]}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{formatSslExpires(row.sslExpiresAt)}</td>
                  <td className="px-4 py-3.5 text-sm text-muted-foreground">{formatCheckedAt(row.lastCheckedAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleCheck(row.id)}
                        disabled={isCheckingId === row.id}
                      >
                        {isCheckingId === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Checar DNS
                      </Button>
                      {!row.isManaged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(row)}
                          disabled={isDeletingId === row.id}
                        >
                          {isDeletingId === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                          Excluir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhum domínio encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateOpen && (
        <Modal className="w-full max-w-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Novo domínio</h2>
                <p className="mt-1 text-sm text-muted-foreground">Vincule um domínio real a um tenant existente.</p>
              </div>
              <Button variant="ghost" size="icon" type="button" 
                onClick={() => {
                  setForm(emptyForm)
                  setIsCreateOpen(false)
                }}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid gap-4 p-5">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tenant</span>
                <NativeSelect
                  value={form.tenantId}
                  onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Selecione um tenant</option>
                  {tenantOptions.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.slug})
                    </option>
                  ))}
                </NativeSelect>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Domínio</span>
                <Input
                  value={form.domain}
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                  placeholder="atendimento.exemplo.com.br"
                  className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="flex items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
                <Input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.target.checked }))}
                  className="rounded-md border-border"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">Definir como domínio principal</p>
                  <p className="text-xs text-muted-foreground">Atualiza o domínio principal do tenant no cadastro.</p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-border p-5">
              <Button
                variant="outline"
                onClick={() => {
                  setForm(emptyForm)
                  setIsCreateOpen(false)
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isSaving || !form.tenantId || !form.domain.trim()}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar domínio
              </Button>
            </div>
          
        </Modal>
      )}
    </div>
  )
}
