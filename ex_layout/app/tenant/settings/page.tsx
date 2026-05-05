"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Globe,
  MessageSquare,
  Bot,
  Palette,
  Bell,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const settingsSections = [
  { id: "general", label: "Geral", icon: Building2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "channels", label: "Canais", icon: MessageSquare },
  { id: "ai", label: "Assistente IA", icon: Bot },
  { id: "team", label: "Equipe", icon: Users },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "security", label: "Segurança", icon: Shield },
]

export default function SettingsPage() {
  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 overflow-hidden">
        {/* Settings Sidebar */}
        <div className="w-56 border-r border-border p-4">
          <h3 className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configurações
          </h3>
          <nav className="space-y-1">
            {settingsSections.map((section, index) => (
              <button
                key={section.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  index === 0
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <section.icon className="h-4 w-4" />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-lg font-semibold text-foreground">Configurações Gerais</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie as informações básicas da sua empresa
            </p>

            {/* Company Info */}
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-card-foreground">
                Informações da Empresa
              </h2>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Nome da Empresa</label>
                  <input
                    type="text"
                    defaultValue="Loja Demo"
                    className="mt-1.5 w-full rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Slug</label>
                  <input
                    type="text"
                    defaultValue="loja-demo"
                    className="mt-1.5 w-full rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Descrição</label>
                  <textarea
                    rows={3}
                    defaultValue="Loja de demonstração para testes da plataforma VisualFlow."
                    className="mt-1.5 w-full resize-none rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {/* Domain */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-card-foreground">Domínio</h2>
              <p className="text-xs text-muted-foreground">
                Configure o domínio de acesso ao console
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground">
                        demo.visualflow.app
                      </p>
                      <p className="text-xs text-muted-foreground">Domínio padrão</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Ativo
                  </span>
                </div>

                <Button variant="outline" size="sm">
                  <Globe className="mr-2 h-4 w-4" />
                  Adicionar domínio próprio
                </Button>
              </div>
            </div>

            {/* WhatsApp Channel */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-card-foreground">Canal WhatsApp</h2>
              <p className="text-xs text-muted-foreground">Status da conexão com WhatsApp</p>

              <div className="mt-6 rounded-lg bg-secondary p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/20">
                      <MessageSquare className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground">
                        +55 11 99999-0000
                      </p>
                      <p className="text-xs text-muted-foreground">Via UAZAPI</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-success/20 px-2.5 py-1 text-xs font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Conectado
                  </span>
                </div>
              </div>
            </div>

            {/* AI Settings Preview */}
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-card-foreground">Assistente IA</h2>
              <p className="text-xs text-muted-foreground">
                Configurações do modelo de linguagem
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-secondary p-4">
                  <div>
                    <p className="text-sm font-medium text-secondary-foreground">Modelo Padrão</p>
                    <p className="text-xs text-muted-foreground">gpt-4o-mini</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Alterar
                  </Button>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">System Prompt</label>
                  <textarea
                    rows={4}
                    defaultValue="Você é um assistente virtual especializado em ajudar clientes a visualizar produtos em seus ambientes. Seja cordial, objetivo e sempre ofereça opções do catálogo quando apropriado."
                    className="mt-1.5 w-full resize-none rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-8 flex justify-end">
              <Button>Salvar Alterações</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
