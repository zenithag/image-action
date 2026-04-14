"use client"

import { useState } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/app-sidebar"
import { ConversationList } from "@/components/conversation-list"
import { ChatPanel } from "@/components/chat-panel"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, MessageSquare } from "lucide-react"

export default function HomePage() {
  const [selectedConversation, setSelectedConversation] = useState<string>("1")
  const [activeTab, setActiveTab] = useState<"tenant" | "superadmin">("tenant")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Navigation Toggle */}
      <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "tenant" | "superadmin")}>
          <TabsList className="grid w-[300px] grid-cols-2">
            <TabsTrigger value="tenant" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Tenant Console
            </TabsTrigger>
            <TabsTrigger value="superadmin" className="gap-2">
              <Building2 className="h-4 w-4" />
              Superadmin
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "tenant" ? (
        <>
          <AppSidebar
            variant="tenant"
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((p) => !p)}
          />
          <div className="flex flex-1 overflow-hidden">
            <div className="w-80 shrink-0">
              <ConversationList
                selectedId={selectedConversation}
                onSelect={setSelectedConversation}
              />
            </div>
            <div className="flex-1">
              <ChatPanel conversationId={selectedConversation} />
            </div>
          </div>
        </>
      ) : (
        <>
          <AppSidebar
            variant="superadmin"
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((p) => !p)}
          />
          <div className="flex-1">
            <SuperadminDashboard />
          </div>
        </>
      )}
    </div>
  )
}

function SuperadminDashboard() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard Superadmin</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral da plataforma
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 p-6">
        {[
          { label: "Tenants Ativos", value: "12", change: "+2 este mês" },
          { label: "Conversas Hoje", value: "847", change: "+23% vs ontem" },
          { label: "Composições Hoje", value: "156", change: "+12% vs ontem" },
          { label: "Custo Estimado", value: "R$ 1.234", change: "Mês atual" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="px-6 pb-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Acesso Rápido</h2>
        <div className="grid grid-cols-3 gap-4">
          <Link
            href="/superadmin"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Building2 className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Gerenciar Tenants</p>
              <p className="text-xs text-muted-foreground">12 tenants ativos</p>
            </div>
          </Link>

          <Link
            href="/superadmin/usage"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <svg className="h-5 w-5 text-secondary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-card-foreground">Uso & Custos</p>
              <p className="text-xs text-muted-foreground">Ver métricas detalhadas</p>
            </div>
          </Link>

          <Link
            href="/superadmin/channels"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <MessageSquare className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="font-medium text-card-foreground">Canais WhatsApp</p>
              <p className="text-xs text-muted-foreground">8 sessões conectadas</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="flex-1 px-6 pb-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Atividade Recente</h2>
        <div className="rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {[
              { tenant: "Casa & Decoração", action: "Nova composição concluída", time: "2 min atrás" },
              { tenant: "Loja Demo", action: "Conversa assumida por operador", time: "5 min atrás" },
              { tenant: "Revestimentos Top", action: "Novo contato registrado", time: "12 min atrás" },
              { tenant: "Casa & Decoração", action: "Job de composição falhou", time: "15 min atrás" },
              { tenant: "Loja Demo", action: "Nova composição concluída", time: "18 min atrás" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-card-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.tenant}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
