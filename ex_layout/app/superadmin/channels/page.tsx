"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Smartphone, Mail } from "lucide-react"

const mockChannels = [
  {
    id: "1",
    name: "WhatsApp",
    type: "whatsapp",
    status: "ativo",
    connections: 24,
    messagesMonthly: 12400,
    createdAt: "5 de janeiro de 2025",
  },
  {
    id: "2",
    name: "Email",
    type: "email",
    status: "ativo",
    connections: 18,
    messagesMonthly: 5600,
    createdAt: "10 de janeiro de 2025",
  },
  {
    id: "3",
    name: "Instagram",
    type: "instagram",
    status: "inativo",
    connections: 8,
    messagesMonthly: 0,
    createdAt: "15 de fevereiro de 2025",
  },
  {
    id: "4",
    name: "Telegram",
    type: "telegram",
    status: "ativo",
    connections: 12,
    messagesMonthly: 3200,
    createdAt: "20 de fevereiro de 2025",
  },
]

const getChannelIcon = (type: string) => {
  switch (type) {
    case "whatsapp":
      return <Smartphone className="h-4 w-4" />
    case "email":
      return <Mail className="h-4 w-4" />
    default:
      return <Smartphone className="h-4 w-4" />
  }
}

export default function ChannelsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="superadmin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Canais</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie os canais de comunicação disponíveis
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Canal
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="border-b border-border bg-card px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar canal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Grid View */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {mockChannels.map((channel) => (
              <Card key={channel.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                        {getChannelIcon(channel.type)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{channel.name}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">{channel.type}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        channel.status === "ativo"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {channel.status === "ativo" ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Conexões Ativas</p>
                    <p className="text-2xl font-bold text-foreground">{channel.connections}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mensagens (este mês)</p>
                    <p className="text-lg font-semibold text-foreground">{channel.messagesMonthly.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Adicionado em</p>
                    <p className="text-sm text-foreground">{channel.createdAt}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" size="sm">
                      <Edit2 className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="outline" className="flex-1 text-destructive hover:text-destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Deletar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
