"use client"

import {
  Building2,
  Globe,
  Plus,
  MoreVertical,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Image as ImageIcon,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Tenant {
  id: string
  name: string
  slug: string
  status: "draft" | "active" | "suspended" | "archived"
  planCode: string
  domain?: string
  stats: {
    conversations: number
    compositions: number
    contacts: number
  }
  createdAt: string
}

const mockTenants: Tenant[] = [
  {
    id: "1",
    name: "Loja Demo",
    slug: "loja-demo",
    status: "active",
    planCode: "pro",
    domain: "demo.comofica.ai",
    stats: { conversations: 156, compositions: 89, contacts: 234 },
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Casa & Decoração",
    slug: "casa-decoracao",
    status: "active",
    planCode: "enterprise",
    domain: "atendimento.casadecoracao.com.br",
    stats: { conversations: 1240, compositions: 687, contacts: 2156 },
    createdAt: "2024-02-20",
  },
  {
    id: "3",
    name: "Tintas Express",
    slug: "tintas-express",
    status: "suspended",
    planCode: "starter",
    stats: { conversations: 45, compositions: 12, contacts: 67 },
    createdAt: "2024-03-10",
  },
  {
    id: "4",
    name: "Móveis Planejados SP",
    slug: "moveis-sp",
    status: "draft",
    planCode: "pro",
    stats: { conversations: 0, compositions: 0, contacts: 0 },
    createdAt: "2024-04-01",
  },
  {
    id: "5",
    name: "Revestimentos Top",
    slug: "revestimentos-top",
    status: "active",
    planCode: "pro",
    domain: "chat.revestimentostop.com",
    stats: { conversations: 432, compositions: 198, contacts: 567 },
    createdAt: "2024-02-05",
  },
]

const statusConfig = {
  draft: {
    label: "Rascunho",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  active: {
    label: "Ativo",
    icon: CheckCircle2,
    className: "bg-success/20 text-success",
  },
  suspended: {
    label: "Suspenso",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive",
  },
  archived: {
    label: "Arquivado",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
}

const planLabels: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

export function SuperadminTenants() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Gerenciamento de Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as empresas cadastradas na plataforma
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 border-b border-border px-6 py-4">
        {[
          { label: "Total de Tenants", value: 5, icon: Building2 },
          { label: "Ativos", value: 3, icon: CheckCircle2 },
          { label: "Conversas (30d)", value: "1.8k", icon: MessageSquare },
          { label: "Composições (30d)", value: 986, icon: ImageIcon },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-lg bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <stat.icon className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 text-xl font-semibold text-card-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="border-b border-border px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar tenants..."
            className="w-full rounded-lg border border-input bg-input py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Tenants List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead className="bg-card">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Tenant
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Plano
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Domínio
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Estatísticas
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockTenants.map((tenant) => {
                const status = statusConfig[tenant.status]
                const StatusIcon = status.icon

                return (
                  <tr key={tenant.id} className="bg-background hover:bg-card/50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                          <Building2 className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                          status.className
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        {planLabels[tenant.planCode]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {tenant.domain ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Globe className="h-3.5 w-3.5" />
                          {tenant.domain}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não configurado</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {tenant.stats.conversations}
                        </span>
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {tenant.stats.compositions}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {tenant.stats.contacts}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
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
