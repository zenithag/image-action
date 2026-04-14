"use client"

import { useState } from "react"
import {
  Building2, Globe, Plus, MoreVertical, Search,
  CheckCircle2, XCircle, Clock, MessageSquare,
  Image as ImageIcon, Users,
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
  stats: { conversations: number; compositions: number; contacts: number }
  createdAt: string
}

const mockTenants: Tenant[] = [
  { id: "1", name: "Loja Demo", slug: "loja-demo", status: "active", planCode: "pro", domain: "demo.visualflow.app", stats: { conversations: 156, compositions: 89, contacts: 234 }, createdAt: "2024-01-15" },
  { id: "2", name: "Casa & Decoração", slug: "casa-decoracao", status: "active", planCode: "enterprise", domain: "atendimento.casadecoracao.com.br", stats: { conversations: 1240, compositions: 687, contacts: 2156 }, createdAt: "2024-02-20" },
  { id: "3", name: "Tintas Express", slug: "tintas-express", status: "suspended", planCode: "starter", stats: { conversations: 45, compositions: 12, contacts: 67 }, createdAt: "2024-03-10" },
  { id: "4", name: "Móveis Planejados SP", slug: "moveis-sp", status: "draft", planCode: "pro", stats: { conversations: 0, compositions: 0, contacts: 0 }, createdAt: "2024-04-01" },
  { id: "5", name: "Revestimentos Top", slug: "revestimentos-top", status: "active", planCode: "pro", domain: "chat.revestimentostop.com", stats: { conversations: 432, compositions: 198, contacts: 567 }, createdAt: "2024-02-05" },
]

const statusConfig = {
  draft: { label: "Rascunho", icon: Clock, className: "bg-muted text-muted-foreground" },
  active: { label: "Ativo", icon: CheckCircle2, className: "bg-primary/20 text-primary" },
  suspended: { label: "Suspenso", icon: XCircle, className: "bg-destructive/20 text-destructive" },
  archived: { label: "Arquivado", icon: Clock, className: "bg-muted text-muted-foreground" },
}

const planLabels: Record<string, { label: string; color: string }> = {
  starter: { label: "Starter", color: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", color: "bg-blue-500/10 text-blue-500" },
  enterprise: { label: "Enterprise", color: "bg-primary/10 text-primary" },
}

export function SuperadminTenants() {
  const [search, setSearch] = useState("")
  const filtered = mockTenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Gerenciamento de Tenants</h1>
          <p className="text-sm text-muted-foreground font-sans">Gerencie as empresas cadastradas na plataforma</p>
        </div>
        <Button className="font-sans rounded-[5px]">
          <Plus className="mr-2 h-4 w-4" /> Novo Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 border-b border-border px-6 py-5 bg-card/20">
        {[
          { label: "Total de Tenants", value: mockTenants.length, icon: Building2, color: "text-foreground" },
          { label: "Ativos", value: mockTenants.filter(t => t.status === "active").length, icon: CheckCircle2, color: "text-primary" },
          { label: "Conversas (30d)", value: "1.8k", icon: MessageSquare, color: "text-blue-500" },
          { label: "Composições (30d)", value: 986, icon: ImageIcon, color: "text-amber-500" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-[5px] border border-border bg-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-muted">
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 text-2xl font-bold text-foreground font-display">{stat.value}</p>
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
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-[5px] border border-input bg-card py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="overflow-hidden rounded-[5px] border border-border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tenant</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Plano</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Domínio</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estatísticas</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((tenant) => {
                const status = statusConfig[tenant.status]
                const StatusIcon = status.icon
                const plan = planLabels[tenant.planCode]
                return (
                  <tr key={tenant.id} className="group transition-colors hover:bg-primary/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-primary/10 text-primary border border-primary/20">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground font-display group-hover:text-primary transition-colors">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tenant.slug}</p>
                        </div>
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
                      {tenant.domain ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Globe className="h-3.5 w-3.5 text-primary/60" />{tenant.domain}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Não configurado</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5 text-primary/50" />{tenant.stats.conversations}</span>
                        <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5 text-primary/50" />{tenant.stats.compositions}</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-primary/50" />{tenant.stats.contacts}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[5px] hover:bg-primary/10 hover:text-primary">
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
