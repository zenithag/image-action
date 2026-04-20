"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Building2,
  Calendar,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Shield,
  Trash2,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Tenant, TenantStatus } from "@/lib/tenant-types"
import { cn } from "@/lib/utils"

const statusConfig: Record<TenantStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-primary/20 text-primary" },
  suspended: { label: "Suspenso", className: "bg-destructive/20 text-destructive" },
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  archived: { label: "Arquivado", className: "bg-muted text-muted-foreground" },
}

const planLabels = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTenant() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(params.id)}`, { cache: "no-store" })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || "Tenant nao encontrado.")
        }

        setTenant(data as Tenant)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Tenant nao encontrado.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadTenant()
  }, [params.id])

  async function removeTenant() {
    if (!tenant || !window.confirm(`Remover o tenant "${tenant.name}"?`)) {
      return
    }

    const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}`, {
      method: "DELETE",
    })

    if (response.ok) {
      router.replace("/superadmin")
      router.refresh()
      return
    }

    const data = await response.json()
    setError(data?.error || "Nao foi possivel remover o tenant.")
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando tenant...</p>
        </div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-4 border-b border-border bg-background py-4 pl-6 pr-10">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[5px] hover:bg-muted" asChild>
            <Link href="/superadmin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Tenant nao encontrado</h1>
            <p className="text-sm text-muted-foreground">{error || "Esse tenant nao existe no cadastro real."}</p>
          </div>
        </div>
      </div>
    )
  }

  const status = statusConfig[tenant.status]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-4 border-b border-border bg-background py-4 pl-6 pr-10">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[5px] hover:bg-muted" asChild>
          <Link href="/superadmin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] border border-primary/20 bg-primary/10 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display truncate text-xl font-bold text-foreground">{tenant.name}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{tenant.slug}</p>
        </div>
        <Button variant="outline" className="h-9 rounded-[5px] font-sans text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeTenant()}>
          <Trash2 className="mr-2 h-4 w-4" /> Remover
        </Button>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-[5px] border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Shield className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Informacoes basicas</h2>
                </div>
                <div className="grid gap-6 p-6 sm:grid-cols-2">
                  <InfoItem icon={Mail} label="Email principal" value={tenant.contactEmail || "Nao configurado"} />
                  <InfoItem icon={Globe} label="Dominio proprio" value={tenant.domain || "Nao configurado"} />
                  <InfoItem label="Plano atual" value={planLabels[tenant.planCode]} />
                  <InfoItem icon={Calendar} label="Data de criacao" value={formatDate(tenant.createdAt)} />
                </div>
              </div>

              <div className="rounded-[5px] border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Dados de contato</h2>
                </div>
                <div className="grid gap-6 p-6 sm:grid-cols-2">
                  <InfoItem label="Responsavel" value={tenant.contactName || "Nao configurado"} />
                  <InfoItem label="Telefone" value={tenant.phone || "Nao configurado"} />
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">Website</p>
                    {tenant.website ? (
                      <a href={tenant.website} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 font-medium text-primary hover:underline">
                        {tenant.website}
                        <ExternalLink className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </a>
                    ) : (
                      <p className="text-sm font-medium">Nao configurado</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Conversas" value={tenant.stats.conversations} icon={MessageSquare} />
                <StatCard label="Composicoes" value={tenant.stats.compositions} icon={Database} />
                <StatCard label="Contatos" value={tenant.stats.contacts} icon={Users} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-[5px] border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Estado do cadastro</h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">ID</span>
                    <span className="truncate font-mono text-xs">{tenant.id}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Slug</span>
                    <span className="font-mono text-xs">{tenant.slug}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Atualizado</span>
                    <span className="text-right text-xs">{formatDate(tenant.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[5px] border border-border bg-card p-6">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Proximos passos</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Este tenant ja existe como cadastro real. O email principal criado no cadastro e a senha inicial definida pelo superadmin ja podem ser usados no login do tenant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Mail
  label: string
  value: string
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary/60" /> : null}
        {value}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Users
}) {
  return (
    <div className="rounded-[5px] border border-border bg-card p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[5px] bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
