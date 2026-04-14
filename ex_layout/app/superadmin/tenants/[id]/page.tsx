"use client"

import { useParams } from "next/navigation"
import { ArrowLeft, Edit2, Trash2, Lock, Users, MessageSquare, BarChart3, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppSidebar } from "@/components/app-sidebar"
import Link from "next/link"

const mockTenant = {
  id: "1",
  name: "Empresa A",
  slug: "empresa-a",
  email: "admin@empresa-a.com.br",
  domain: "empresa.com.br",
  status: "ativo",
  plan: "pro",
  createdAt: "5 de janeiro de 2025",
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
    nextBillingDate: "5 de maio de 2025",
    monthlyBill: 299.90,
  },
  metadata: {
    contactName: "João Silva",
    phone: "+55 11 99999-1234",
    website: "https://empresa-a.com.br",
  },
}

export default function TenantDetailPage() {
  const params = useParams()
  const tenantId = params.id

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="superadmin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/superadmin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{mockTenant.name}</h1>
              <p className="text-sm text-muted-foreground">{mockTenant.slug}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="col-span-2 space-y-6">
              {/* Status & Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">{mockTenant.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Domínio</p>
                      <p className="text-sm font-medium text-foreground">{mockTenant.domain}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className="inline-block rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                        Ativo
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Plano</p>
                      <p className="text-sm font-medium text-foreground capitalize">{mockTenant.plan}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Criação</p>
                      <p className="text-sm font-medium text-foreground">{mockTenant.createdAt}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Último Login</p>
                      <p className="text-sm font-medium text-foreground">{mockTenant.lastLogin}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações de Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome do Contato</p>
                    <p className="text-sm font-medium text-foreground">{mockTenant.metadata.contactName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium text-foreground">{mockTenant.metadata.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Website</p>
                    <a
                      href={mockTenant.metadata.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {mockTenant.metadata.website}
                    </a>
                  </div>
                </CardContent>
              </Card>

              {/* Usage Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estatísticas de Uso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg bg-card p-3">
                      <p className="text-xs text-muted-foreground">Usuários Ativos</p>
                      <p className="text-2xl font-bold text-foreground">{mockTenant.users}</p>
                    </div>
                    <div className="rounded-lg bg-card p-3">
                      <p className="text-xs text-muted-foreground">Conversas</p>
                      <p className="text-2xl font-bold text-foreground">{mockTenant.conversations}</p>
                    </div>
                    <div className="rounded-lg bg-card p-3">
                      <p className="text-xs text-muted-foreground">Mensagens (mês)</p>
                      <p className="text-2xl font-bold text-foreground">{(mockTenant.messagesMonthly / 1000).toFixed(0)}k</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Storage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Armazenamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Uso</p>
                      <p className="text-sm font-medium text-foreground">
                        {mockTenant.storage.used} / {mockTenant.storage.limit} GB
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-card overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(mockTenant.storage.used / mockTenant.storage.limit) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((mockTenant.storage.used / mockTenant.storage.limit) * 100)}% utilizado
                  </p>
                </CardContent>
              </Card>

              {/* Billing */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Faturamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <span className="inline-block rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                      Pago
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Próxima Cobrança</p>
                    <p className="text-sm font-medium text-foreground">{mockTenant.billing.nextBillingDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor Mensal</p>
                    <p className="text-2xl font-bold text-foreground">R$ {mockTenant.billing.monthlyBill.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" variant="outline" size="sm">
                    <Lock className="mr-2 h-4 w-4" />
                    Resetar Senha
                  </Button>
                  <Button className="w-full" variant="outline" size="sm">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Gerenciar Fatura
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
