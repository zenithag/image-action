"use client"

import { useParams } from "next/navigation"
import { ArrowLeft, Phone, Mail, MapPin, MoreVertical, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AppSidebar } from "@/components/app-sidebar"
import Link from "next/link"

const mockConversation = {
  id: "1",
  contactName: "Maria Silva",
  contactPhone: "+55 11 99999-1234",
  contactEmail: "maria.silva@email.com",
  status: "em_andamento",
  startedAt: "14 de abril de 2025, 14:35",
  messages: [
    {
      id: "1",
      sender: "contact",
      text: "Olá, gostaria de saber mais sobre o produto de camiseta premium",
      timestamp: "14:35",
      avatar: "MS",
    },
    {
      id: "2",
      sender: "operator",
      text: "Olá Maria! Claro, fico feliz em ajudar! A camiseta premium é feita com algodão 100% de alta qualidade.",
      timestamp: "14:36",
    },
    {
      id: "3",
      sender: "contact",
      text: "Qual é o preço e quantos dias demora para chegar?",
      timestamp: "14:37",
      avatar: "MS",
    },
    {
      id: "4",
      sender: "operator",
      text: "O preço é R$ 89,90 e entregamos em 3 a 5 dias úteis via correios.",
      timestamp: "14:38",
    },
    {
      id: "5",
      sender: "contact",
      text: "Perfeito! Vou fazer o pedido agora",
      timestamp: "14:39",
      avatar: "MS",
    },
  ],
}

export default function ConversationDetailPage() {
  const params = useParams()
  const conversationId = params.id

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/tenant/inbox">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-foreground">{mockConversation.contactName}</h1>
              <p className="text-sm text-muted-foreground">{mockConversation.startedAt}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Mail className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Contact Info Bar */}
        <div className="border-b border-border bg-card px-6 py-3">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{mockConversation.contactPhone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{mockConversation.contactEmail}</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {mockConversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === "operator" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender === "contact" && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                  {msg.avatar}
                </div>
              )}
              <div
                className={`max-w-md rounded-lg px-4 py-2 ${
                  msg.sender === "operator"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className={`mt-1 text-xs ${msg.sender === "operator" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button>Enviar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
