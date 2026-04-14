"use client"

import { useState } from "react"
import { Search, Plus, Edit2, Trash2, Smartphone, Mail, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Channel {
  id: string
  name: string
  type: "whatsapp" | "email" | "instagram" | "telegram"
  status: "ativo" | "inativo"
  connections: number
  messagesMonthly: number
  createdAt: string
}

const mockChannels: Channel[] = [
  { id: "1", name: "WhatsApp", type: "whatsapp", status: "ativo", connections: 24, messagesMonthly: 12400, createdAt: "5 de janeiro de 2025" },
  { id: "2", name: "Email", type: "email", status: "ativo", connections: 18, messagesMonthly: 5600, createdAt: "10 de janeiro de 2025" },
  { id: "3", name: "Instagram", type: "instagram", status: "inativo", connections: 8, messagesMonthly: 0, createdAt: "15 de fevereiro de 2025" },
  { id: "4", name: "Telegram", type: "telegram", status: "ativo", connections: 12, messagesMonthly: 3200, createdAt: "20 de fevereiro de 2025" },
]

const channelConfig: Record<Channel["type"], { icon: React.ElementType; color: string; bg: string }> = {
  whatsapp: { icon: Smartphone, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  email: { icon: Mail, color: "text-blue-500", bg: "bg-blue-500/10" },
  instagram: { icon: MessageCircle, color: "text-pink-500", bg: "bg-pink-500/10" },
  telegram: { icon: Send, color: "text-sky-500", bg: "bg-sky-500/10" },
}

export default function ChannelsPage() {
  const [search, setSearch] = useState("")

  const filtered = mockChannels.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalMessages = mockChannels.reduce((s, c) => s + c.messagesMonthly, 0)
  const totalConnections = mockChannels.reduce((s, c) => s + c.connections, 0)
  const activeCount = mockChannels.filter(c => c.status === "ativo").length

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Canais</h1>
          <p className="text-sm text-muted-foreground font-sans">Gerencie os canais de comunicação disponíveis</p>
        </div>
        <Button className="font-sans rounded-[5px]">
          <Plus className="mr-2 h-4 w-4" /> Novo Canal
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 border-b border-border px-6 py-5 bg-card/20">
        {[
          { label: "Total de Canais", value: mockChannels.length },
          { label: "Ativos", value: activeCount },
          { label: "Conexões Totais", value: totalConnections },
          { label: "Mensagens (mês)", value: totalMessages.toLocaleString() },
        ].map(s => (
          <div key={s.label} className="rounded-[5px] border border-border bg-card px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground font-display">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="border-b border-border px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar canal..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-[5px] border border-input bg-card py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="grid grid-cols-2 gap-6 max-w-5xl">
          {filtered.map(channel => {
            const config = channelConfig[channel.type]
            const Icon = config.icon
            return (
              <div key={channel.id} className="group rounded-[5px] border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-[5px]", config.bg)}>
                      <Icon className={cn("h-6 w-6", config.color)} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground font-display group-hover:text-primary transition-colors">{channel.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{channel.type}</p>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                    channel.status === "ativo" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    {channel.status === "ativo" ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="rounded-[4px] bg-muted/30 p-3 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Conexões</p>
                    <p className="text-xl font-bold text-foreground">{channel.connections}</p>
                  </div>
                  <div className="rounded-[4px] bg-muted/30 p-3 border border-border col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Mensagens (mês)</p>
                    <p className="text-xl font-bold text-foreground">{channel.messagesMonthly.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Taxa de utilização</span>
                    <span>{channel.status === "ativo" ? Math.round((channel.connections / 30) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: channel.status === "ativo" ? `${Math.min((channel.connections / 30) * 100, 100)}%` : "0%" }}
                    />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground mb-4">Adicionado em {channel.createdAt}</p>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 font-sans rounded-[5px]">
                    <Edit2 className="mr-2 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 font-sans rounded-[5px] text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Deletar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
