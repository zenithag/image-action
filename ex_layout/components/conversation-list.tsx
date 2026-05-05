"use client"

import { cn } from "@/lib/utils"
import { MessageSquare, Bot, User, Clock } from "lucide-react"

interface Conversation {
  id: string
  contact: {
    name: string
    phone: string
    avatar?: string
  }
  lastMessage: string
  lastMessageAt: string
  status: "open" | "waiting_customer" | "waiting_operator" | "closed"
  handledBy: "ai" | "operator"
  unreadCount?: number
  state: string
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    contact: { name: "Maria Silva", phone: "+55 11 99999-1234" },
    lastMessage: "Gostaria de ver como ficaria a tinta azul na minha sala",
    lastMessageAt: "2 min",
    status: "open",
    handledBy: "ai",
    unreadCount: 2,
    state: "collecting_preferences",
  },
  {
    id: "2",
    contact: { name: "Carlos Santos", phone: "+55 21 98888-5678" },
    lastMessage: "Perfeito! Adorei o resultado, obrigado!",
    lastMessageAt: "15 min",
    status: "waiting_customer",
    handledBy: "ai",
    state: "completed",
  },
  {
    id: "3",
    contact: { name: "Ana Costa", phone: "+55 31 97777-9012" },
    lastMessage: "Vocês trabalham com móveis planejados?",
    lastMessageAt: "1h",
    status: "waiting_operator",
    handledBy: "operator",
    unreadCount: 1,
    state: "idle",
  },
  {
    id: "4",
    contact: { name: "Pedro Oliveira", phone: "+55 41 96666-3456" },
    lastMessage: "Quero ver o piso de madeira no quarto",
    lastMessageAt: "2h",
    status: "open",
    handledBy: "ai",
    state: "composing",
  },
  {
    id: "5",
    contact: { name: "Julia Ferreira", phone: "+55 51 95555-7890" },
    lastMessage: "Pode me mostrar mais opções de cores?",
    lastMessageAt: "3h",
    status: "open",
    handledBy: "ai",
    state: "showing_options",
  },
]

const statusColors = {
  open: "bg-success",
  waiting_customer: "bg-warning",
  waiting_operator: "bg-chart-5",
  closed: "bg-muted-foreground",
}

const stateLabels: Record<string, string> = {
  idle: "Aguardando",
  awaiting_base_image: "Solicitando foto",
  collecting_preferences: "Coletando preferências",
  showing_options: "Mostrando opções",
  awaiting_selection: "Aguardando seleção",
  composing: "Gerando imagem",
  completed: "Concluído",
}

interface ConversationListProps {
  selectedId?: string
  onSelect?: (id: string) => void
}

export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-card-foreground">Conversas</h2>
        <span className="flex h-5 items-center rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground">
          {mockConversations.length}
        </span>
      </div>

      <div className="flex gap-1 border-b border-border p-2">
        <button className="flex-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
          Todas
        </button>
        <button className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/50">
          IA
        </button>
        <button className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/50">
          Operador
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {mockConversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect?.(conversation.id)}
            className={cn(
              "flex w-full items-start gap-3 border-b border-border p-4 text-left transition-colors hover:bg-secondary/50",
              selectedId === conversation.id && "bg-secondary"
            )}
          >
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                {conversation.contact.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                  statusColors[conversation.status]
                )}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-card-foreground">
                  {conversation.contact.name}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {conversation.lastMessageAt}
                </span>
              </div>

              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {conversation.lastMessage}
              </p>

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {conversation.handledBy === "ai" ? (
                    <Bot className="h-3 w-3 text-primary" />
                  ) : (
                    <User className="h-3 w-3 text-chart-5" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {stateLabels[conversation.state] || conversation.state}
                  </span>
                </div>

                {conversation.unreadCount && conversation.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
