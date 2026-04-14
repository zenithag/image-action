"use client"

import { useParams } from "next/navigation"
import { ArrowLeft, Mail, Phone, Calendar, MessageSquare, Edit2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppSidebar } from "@/components/app-sidebar"
import Link from "next/link"

const mockContact = {
  id: "1",
  name: "Maria Silva",
  phone: "+55 11 99999-1234",
  email: "maria.silva@email.com",
  joinedDate: "5 de janeiro de 2025",
  lastContact: "Hoje, 14:35",
  conversationsCount: 5,
  status: "ativo",
  avatar: "MS",
  metadata: {
    city: "São Paulo",
    state: "SP",
    lastConversationDate: "2025-04-14",
    totalMessages: 42,
    averageResponseTime: "2 minutos",
  },
}

export default function ContactDetailPage() {
  const params = useParams()
  const contactId = params.id

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/tenant/contacts">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{mockContact.name}</h1>
              <p className="text-sm text-muted-foreground">
                {mockContact.status === "ativo" ? "Contato Ativo" : "Inativo"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="col-span-2 space-y-6">
              {/* Contact Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações de Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium text-foreground">{mockContact.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">{mockContact.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Data de Entrada</p>
                      <p className="text-sm font-medium text-foreground">{mockContact.joinedDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Conversations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Histórico de Conversas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="rounded-lg bg-card p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">Conversa #1</p>
                          <p className="text-xs text-muted-foreground">Ontem, 14:30 - 2 minutos</p>
                        </div>
                        <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                          Resolvida
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg bg-card p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-foreground">Conversa #2</p>
                          <p className="text-xs text-muted-foreground">Hoje, 14:35 - 5 minutos</p>
                        </div>
                        <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600">
                          Em andamento
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estatísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Mensagens</p>
                    <p className="text-2xl font-bold text-foreground">{mockContact.metadata.totalMessages}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tempo Médio de Resposta</p>
                    <p className="text-sm font-medium text-foreground">{mockContact.metadata.averageResponseTime}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Localização</p>
                    <p className="text-sm font-medium text-foreground">
                      {mockContact.metadata.city}, {mockContact.metadata.state}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full" variant="outline" size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Nova Conversa
                  </Button>
                  <Button className="w-full" variant="outline" size="sm">
                    Enviar Mensagem
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
