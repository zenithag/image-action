"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Send,
  Paperclip,
  MoreVertical,
  Bot,
  User,
  Image as ImageIcon,
  Phone,
  CheckCheck,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface Message {
  id: string
  role: "customer" | "assistant" | "operator" | "system"
  content: string
  contentType: "text" | "image" | "catalog_options" | "composition_result"
  imageUrl?: string
  createdAt: string
  status?: "sent" | "delivered" | "read"
}

const mockMessages: Message[] = [
  {
    id: "1",
    role: "customer",
    content: "Olá! Gostaria de ver como ficaria uma tinta azul na minha sala de estar.",
    contentType: "text",
    createdAt: "14:30",
    status: "read",
  },
  {
    id: "2",
    role: "assistant",
    content: "Olá! Claro, ficarei feliz em ajudar você a visualizar sua sala com uma nova cor! Para começar, poderia me enviar uma foto do ambiente que deseja transformar?",
    contentType: "text",
    createdAt: "14:30",
  },
  {
    id: "3",
    role: "customer",
    content: "",
    contentType: "image",
    imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&h=300&fit=crop",
    createdAt: "14:32",
    status: "read",
  },
  {
    id: "4",
    role: "assistant",
    content: "Ótima foto! Que tipo de azul você tem em mente? Temos algumas opções lindas:\n\n1. Azul Petróleo - Tom profundo e elegante\n2. Azul Serenity - Suave e relaxante\n3. Azul Marinho - Clássico e sofisticado\n4. Azul Celeste - Leve e arejado\n\nQual dessas cores você gostaria de visualizar?",
    contentType: "text",
    createdAt: "14:32",
  },
  {
    id: "5",
    role: "customer",
    content: "Gostei do Azul Petróleo! Pode me mostrar como ficaria?",
    contentType: "text",
    createdAt: "14:35",
    status: "read",
  },
  {
    id: "6",
    role: "system",
    content: "Gerando visualização...",
    contentType: "text",
    createdAt: "14:35",
  },
]

interface ChatPanelProps {
  conversationId?: string
}

export function ChatPanel({ conversationId }: ChatPanelProps) {
  const [message, setMessage] = useState("")

  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-foreground">Selecione uma conversa</h3>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Escolha uma conversa na lista para visualizar as mensagens
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            MS
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">Maria Silva</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>+55 11 99999-1234</span>
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3 text-primary" />
                IA ativa
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Assumir conversa
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {mockMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "customer" ? "justify-end" : "justify-start",
                msg.role === "system" && "justify-center"
              )}
            >
              {msg.role === "system" ? (
                <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {msg.content}
                </div>
              ) : (
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5",
                    msg.role === "customer"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-card-foreground"
                  )}
                >
                  {msg.role !== "customer" && (
                    <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {msg.role === "assistant" ? (
                        <>
                          <Bot className="h-3 w-3 text-primary" />
                          <span>Assistente IA</span>
                        </>
                      ) : (
                        <>
                          <User className="h-3 w-3" />
                          <span>Operador</span>
                        </>
                      )}
                    </div>
                  )}

                  {msg.contentType === "image" && msg.imageUrl ? (
                    <img
                      src={msg.imageUrl}
                      alt="Imagem enviada"
                      className="h-auto max-w-full rounded-lg border-0 outline-none"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  )}

                  <div
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-xs",
                      msg.role === "customer" ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    <span>{msg.createdAt}</span>
                    {msg.role === "customer" && msg.status === "read" && (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
            <ImageIcon className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite uma mensagem..."
              rows={1}
              className="w-full resize-none rounded-lg border border-input bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Button size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
