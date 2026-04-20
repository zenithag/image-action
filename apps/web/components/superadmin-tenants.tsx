"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Building2,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Tenant, TenantInput, TenantPlanCode, TenantStatus } from "@/lib/tenant-types"
import { cn } from "@/lib/utils"

type TenantCreateForm = TenantInput & {
  initialUserPassword: string
  initialUserPasswordConfirmation: string
}

const statusConfig: Record<TenantStatus, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Rascunho", icon: Clock, className: "bg-muted text-muted-foreground" },
  active: { label: "Ativo", icon: CheckCircle2, className: "bg-primary/20 text-primary" },
  suspended: { label: "Suspenso", icon: XCircle, className: "bg-destructive/20 text-destructive" },
  archived: { label: "Arquivado", icon: Clock, className: "bg-muted text-muted-foreground" },
}

const planLabels: Record<TenantPlanCode, { label: string; color: string }> = {
  starter: { label: "Starter", color: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", color: "bg-blue-500/10 text-blue-500" },
  enterprise: { label: "Enterprise", color: "bg-primary/10 text-primary" },
}

const initialForm: TenantCreateForm = {
  name: "",
  slug: "",
  status: "active",
  planCode: "starter",
  contactEmail: "",
  contactName: "",
  phone: "",
  initialUserPassword: "",
  initialUserPasswordConfirmation: "",
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getStats(tenants: Tenant[]) {
  return tenants.reduce(
    (acc, tenant) => ({
      total: acc.total + 1,
      active: acc.active + (tenant.status === "active" ? 1 : 0),
      conversations: acc.conversations + tenant.stats.conversations,
      compositions: acc.compositions + tenant.stats.compositions,
    }),
    { total: 0, active: 0, conversations: 0, compositions: 0 }
  )
}

function getPasswordChecks(password: string) {
  return [
    { label: "12 caracteres", valid: password.length >= 12 },
    { label: "letra maiuscula", valid: /[A-Z]/.test(password) },
    { label: "letra minuscula", valid: /[a-z]/.test(password) },
    { label: "numero", valid: /[0-9]/.test(password) },
    { label: "caractere especial", valid: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function SuperadminTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [form, setForm] = useState<TenantCreateForm>(initialForm)
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadTenants() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/superadmin/tenants", { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel carregar tenants.")
      }

      setTenants(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar tenants.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTenants()
  }, [])

  const filtered = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim()

    if (!normalizedSearch) {
      return tenants
    }

    return tenants.filter((tenant) =>
      tenant.name.toLowerCase().includes(normalizedSearch) ||
      tenant.slug.toLowerCase().includes(normalizedSearch)
    )
  }, [search, tenants])

  const stats = useMemo(() => getStats(tenants), [tenants])
  const passwordChecks = useMemo(() => getPasswordChecks(form.initialUserPassword), [form.initialUserPassword])
  const isPasswordStrong = passwordChecks.every((check) => check.valid)
  const canCreateTenant = Boolean(
    form.name.trim() &&
    form.contactEmail?.trim() &&
    isPasswordStrong &&
    form.initialUserPassword === form.initialUserPasswordConfirmation
  )

  function openNewTenantModal() {
    setForm(initialForm)
    setIsSlugManuallyEdited(false)
    setError(null)
    setIsNewModalOpen(true)
  }

  function closeNewTenantModal() {
    setForm(initialForm)
    setIsSlugManuallyEdited(false)
    setIsNewModalOpen(false)
  }

  function updateField<K extends keyof TenantCreateForm>(field: K, value: TenantCreateForm[K]) {
    if (field === "slug") {
      setIsSlugManuallyEdited(true)
    }

    setForm((current) => ({
      ...current,
      [field]: value,
      slug: field === "name" && !isSlugManuallyEdited ? slugify(String(value ?? "")) : field === "slug" ? String(value ?? "") : current.slug,
    }))
  }

  async function createTenant() {
    setIsSaving(true)
    setError(null)

    try {
      const payload: TenantInput = {
        ...form,
        slug: form.slug || slugify(form.name),
      }
      const response = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel criar o tenant.")
      }

      setTenants((current) => [data as Tenant, ...current].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")))
      closeNewTenantModal()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel criar o tenant.")
    } finally {
      setIsSaving(false)
    }
  }

  async function removeTenant(tenant: Tenant) {
    const shouldDelete = window.confirm(`Remover o tenant "${tenant.name}"? Esta acao nao remove dados de conversas ja existentes.`)

    if (!shouldDelete) {
      return
    }

    setError(null)

    try {
      const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel remover o tenant.")
      }

      setTenants((current) => current.filter((item) => item.id !== tenant.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel remover o tenant.")
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative z-10 flex items-center justify-between border-b border-border bg-background py-4 pl-6 pr-10">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Gerenciamento de Tenants</h1>
          <p className="font-sans text-sm text-muted-foreground">Cadastre e acompanhe empresas reais da plataforma</p>
        </div>
        <Button className="rounded-[5px] font-sans" onClick={openNewTenantModal}>
          <Plus className="mr-2 h-4 w-4" /> Novo Tenant
        </Button>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      {isNewModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={closeNewTenantModal}>
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[10px] bg-card p-8 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6">
              <h2 className="font-display text-xl font-bold">Novo Tenant</h2>
              <p className="text-sm text-muted-foreground">Cadastre uma empresa real. Nenhum dado mockado sera criado.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Nome da empresa</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Ex: Decor Labs"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(event) => updateField("slug", slugify(event.target.value))}
                  placeholder="decor-labs"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Plano</label>
                <select
                  value={form.planCode}
                  onChange={(event) => updateField("planCode", event.target.value as TenantPlanCode)}
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Status inicial</label>
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value as TenantStatus)}
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="active">Ativo</option>
                  <option value="draft">Rascunho</option>
                  <option value="suspended">Suspenso</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Email principal</label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => updateField("contactEmail", event.target.value)}
                  placeholder="responsavel@empresa.com"
                  autoComplete="email"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">Esse email sera o login inicial do tenant.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Responsavel</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(event) => updateField("contactName", event.target.value)}
                  placeholder="Nome do responsavel"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Telefone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Senha inicial forte</label>
                <input
                  type="password"
                  value={form.initialUserPassword}
                  onChange={(event) => updateField("initialUserPassword", event.target.value)}
                  placeholder="Minimo 12 caracteres"
                  autoComplete="new-password"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex flex-wrap gap-1.5">
                  {passwordChecks.map((check) => (
                    <span
                      key={check.label}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        check.valid ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {check.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Confirmar senha</label>
                <input
                  type="password"
                  value={form.initialUserPasswordConfirmation}
                  onChange={(event) => updateField("initialUserPasswordConfirmation", event.target.value)}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  className="w-full rounded-[5px] border border-input bg-muted/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {form.initialUserPasswordConfirmation && form.initialUserPassword !== form.initialUserPasswordConfirmation ? (
                  <p className="text-[11px] font-medium text-destructive">A confirmacao ainda nao confere.</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button className="flex-1 rounded-[5px] py-6 font-sans" disabled={isSaving || !canCreateTenant} onClick={() => void createTenant()}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Criar tenant
              </Button>
              <Button variant="outline" className="flex-1 rounded-[5px] py-6 font-sans" disabled={isSaving} onClick={closeNewTenantModal}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-4 border-b border-border bg-card/20 px-6 py-5">
        {[
          { label: "Total de Tenants", value: stats.total, icon: Building2, color: "text-foreground" },
          { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "text-primary" },
          { label: "Conversas (30d)", value: stats.conversations, icon: MessageSquare, color: "text-blue-500" },
          { label: "Composições (30d)", value: stats.compositions, icon: ImageIcon, color: "text-amber-500" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-[5px] border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-muted">
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <p className="font-display mt-0.5 text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-b border-border px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar tenants..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-[5px] border border-input bg-card py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="overflow-hidden rounded-[5px] border border-border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tenant</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plano</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estatisticas</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary" />
                    Carregando tenants reais...
                  </td>
                </tr>
              ) : null}

              {!isLoading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
                    <p className="font-display text-lg font-bold text-foreground">
                      {tenants.length === 0 ? "Nenhum tenant cadastrado" : "Nenhum tenant encontrado"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tenants.length === 0 ? "Cadastre o primeiro tenant real para iniciar os testes." : "Ajuste a busca para ver outros tenants."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!isLoading && filtered.map((tenant) => {
                const status = statusConfig[tenant.status]
                const StatusIcon = status.icon
                const plan = planLabels[tenant.planCode]

                return (
                  <tr key={tenant.id} className="group transition-colors hover:bg-primary/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[5px] border border-primary/20 bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <Link href={`/superadmin/tenants/${tenant.id}`} className="min-w-0">
                          <p className="font-display truncate font-bold text-foreground transition-colors group-hover:text-primary">{tenant.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">{tenant.slug}</p>
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", status.className)}>
                        <StatusIcon className="h-3 w-3" />{status.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("rounded-[4px] px-2.5 py-1 text-[10px] font-bold uppercase", plan.color)}>{plan.label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-primary/50" />{tenant.stats.conversations}</span>
                        <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5 text-primary/50" />{tenant.stats.compositions}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-primary/50" />{tenant.stats.contacts}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] hover:bg-primary/10 hover:text-primary" asChild>
                          <Link href={`/superadmin/tenants/${tenant.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeTenant(tenant)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
