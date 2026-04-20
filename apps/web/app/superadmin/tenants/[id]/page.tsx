"use client"

import { useParams } from "next/navigation"
import {
  ArrowLeft, Edit2, Trash2, Lock, Users, MessageSquare,
  BarChart3, CreditCard, Building2, Globe, Mail,
  Calendar, Clock, Shield, Database, ExternalLink,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

const mockTenant = {
  id: "1",
  name: "Loja Demo",
  slug: "loja-demo",
  email: "contato@lojademo.com.br",
  domain: "demo.comofica.ai",
  status: "active",
  plan: "pro",
  createdAt: "15 Jan 2024",
  lastLogin: "Hoje, 14:35",
  users: 12,
  conversations: 245,
  messagesMonthly: 12400,
  storage: {
    used: 2.4,
    limit: 5.0,
  },
  billing: {
    status: "pago",
    nextBillingDate: "05 Mai 2025",
    monthlyBill: 299.90,
  },
  metadata: {
    contactName: "João Silva",
    phone: "+55 11 99999-1234",
    website: "https://lojademo.com.br",
  },
}

const statusConfig = {
  active: { label: "Ativo", className: "bg-primary/20 text-primary" },
  suspended: { label: "Suspenso", className: "bg-destructive/20 text-destructive" },
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
}

export default function TenantDetailPage() {
  const params = useParams()
  const tenantId = params.id

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border pl-6 pr-10 py-4 bg-background">
        <Link href="/superadmin">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-[5px] hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-12 w-12 items-center justify-center rounded-[5px] bg-primary/10 text-primary border border-primary/20 shrink-0">
          <Building2 className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground font-display truncate">{mockTenant.name}</h1>
            <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", statusConfig[mockTenant.status as keyof typeof statusConfig]?.className)}>
              {statusConfig[mockTenant.status as keyof typeof statusConfig]?.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">{mockTenant.slug}.comofica.ai</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-sans rounded-[5px] h-9">
            <Edit2 className="mr-2 h-4 w-4" /> Editar
          </Button>
          <Button variant="outline" className="font-sans rounded-[5px] h-9 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Deletar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-3 gap-6">
            
            {/* Left Column: Basic Info & Contact */}
            <div className="col-span-2 space-y-6">
              
              {/* Basic Info */}
              <div className="rounded-[5px] border border-border bg-card">
                <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold font-display uppercase tracking-widest text-muted-foreground">Informações Básicas</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Email Principal</p>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-3.5 w-3.5 text-primary/60" />
                        {mockTenant.email}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Domínio Próprio</p>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Globe className="h-3.5 w-3.5 text-primary/60" />
                        {mockTenant.domain || "Não configurado"}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Plano Atual</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-[4px] bg-primary/10 text-primary px-2.5 py-1 text-[10px] font-bold uppercase border border-primary/20">
                          {mockTenant.plan}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Data de Criação</p>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5 text-primary/60" />
                        {mockTenant.createdAt}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Metadata */}
              <div className="rounded-[5px] border border-border bg-card">
                <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-bold font-display uppercase tracking-widest text-muted-foreground">Dados de Contato</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Responsável</p>
                      <p className="text-sm font-bold font-display">{mockTenant.metadata.contactName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Telefone</p>
                      <p className="text-sm font-medium">{mockTenant.metadata.phone}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-border mt-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Website</p>
                      <a href={mockTenant.metadata.website} target="_blank" rel="noopener noreferrer" 
                         className="inline-flex items-center gap-2 text-primary font-medium hover:underline group">
                        {mockTenant.metadata.website}
                        <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Usuários", value: mockTenant.users, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
                  { label: "Conversas", value: mockTenant.conversations, icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Msgs (mês)", value: `${(mockTenant.messagesMonthly / 1000).toFixed(0)}k`, icon: BarChart3, color: "text-amber-500", bg: "bg-amber-500/10" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[5px] border border-border bg-card p-4">
                    <div className={cn("h-8 w-8 flex items-center justify-center rounded-[5px] mb-3", stat.bg)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold text-foreground font-display">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Storage & Billing */}
            <div className="space-y-6">
              
              {/* Storage */}
              <div className="rounded-[5px] border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-bold font-display uppercase tracking-widest text-muted-foreground">Armazenamento</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-foreground font-display">{mockTenant.storage.used} GB</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Utilizado de {mockTenant.storage.limit} GB</p>
                    </div>
                    <p className="text-xl font-bold text-primary font-display">
                      {Math.round((mockTenant.storage.used / mockTenant.storage.limit) * 100)}%
                    </p>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(mockTenant.storage.used / mockTenant.storage.limit) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground italic leading-tight pt-2">
                    Próximo ao limite. Considere upgrade para volume elástico.
                  </p>
                </div>
              </div>

              {/* Billing */}
              <div className="rounded-[5px] border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-bold font-display uppercase tracking-widest text-muted-foreground">Faturamento</h3>
                </div>
                <div className="space-y-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-bold uppercase">Status</span>
                    <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border border-primary/20">
                      {mockTenant.billing.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-bold uppercase">Próxima Fatura</span>
                    <span className="text-sm font-bold font-display">{mockTenant.billing.nextBillingDate}</span>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Valor Mensal</p>
                    <p className="text-2xl font-bold text-foreground font-display">R$ {mockTenant.billing.monthlyBill.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button className="w-full font-sans rounded-[5px] h-11 border-border justify-start px-4" variant="outline">
                  <Lock className="mr-3 h-4 w-4 text-muted-foreground" />
                  Resetar Senha Administrador
                </Button>
                <Button className="w-full font-sans rounded-[5px] h-11 border-border justify-start px-4" variant="outline">
                  <CreditCard className="mr-3 h-4 w-4 text-muted-foreground" />
                  Gerenciar Assinatura
                </Button>
                <Button className="w-full font-sans rounded-[5px] h-11 border-border justify-start px-4" variant="outline">
                  <Clock className="mr-3 h-4 w-4 text-muted-foreground" />
                  Ver Logs de Acesso
                </Button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
