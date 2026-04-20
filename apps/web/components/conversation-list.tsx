"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import type { InboxConversationSummary, InboxHandledBy } from "@/lib/inbox-types"
import { Bot, Clock, MessageSquare, RefreshCw, User } from "lucide-react"

const statusColors = {
  open: "bg-primary",
  waiting_customer: "bg-emerald-400",
  waiting_operator: "bg-teal-500",
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
  tenantSlug: string
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WA"
}

function formatRelativeTime(value: string) {
  const elapsedMs = Date.now() - new Date(value).getTime()
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000))

  if (elapsedMinutes < 1) return "agora"
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`

  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) return `${elapsedHours}h`

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value))
}

export function ConversationList({ tenantSlug, selectedId, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<InboxConversationSummary[]>([])
  const [filter, setFilter] = useState<"all" | InboxHandledBy>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadConversations(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true)
      setError(null)
    }

    try {
      await fetch(`/api/tenant/${tenantSlug}/inbox/sync`, {
        method: "POST",
      }).catch(() => null)

      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar as conversas.")
      }

      const data = await response.json() as InboxConversationSummary[]
      setConversations(data)
      window.dispatchEvent(new CustomEvent("inbox:unread-changed"))

      if (!selectedId && data[0]) {
        onSelect?.(data[0].id)
      }

      if (selectedId && !data.some((conversation) => conversation.id === selectedId)) {
        onSelect?.(data[0]?.id ?? null)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar conversas.")
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  async function markConversationAsRead(conversationId: string) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )
    )

    await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: "POST",
    }).catch(() => null)

    window.dispatchEvent(new CustomEvent("inbox:unread-changed"))
  }

  useEffect(() => {
    void loadConversations()
  }, [tenantSlug])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadConversations({ silent: true })
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [tenantSlug, selectedId])

  const filteredConversations = useMemo(() => {
    if (filter === "all") return conversations
    return conversations.filter((conversation) => conversation.handledBy === filter)
  }, [conversations, filter])

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-card-foreground font-display">Conversas</h2>
            <button
              type="button"
              onClick={() => loadConversations()}
              className="rounded-[5px] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Atualizar conversas"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </button>
          </div>
          <span className="flex h-5 items-center rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground">
            {conversations.length}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 gap-1 border-b border-border p-2">
        {[
          { id: "all", label: "Todas" },
          { id: "ai", label: "IA" },
          { id: "operator", label: "Operador" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id as "all" | InboxHandledBy)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs transition-colors",
              filter === item.id
                ? "bg-primary/20 font-bold text-primary"
                : "font-medium text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Carregando conversas...
          </div>
        ) : filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => {
                onSelect?.(conversation.id)
                void markConversationAsRead(conversation.id)
              }}
              className={cn(
                "flex w-full items-start gap-3 border-b border-border p-4 text-left transition-all duration-200",
                selectedId === conversation.id
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : "bg-transparent hover:bg-primary/5"
              )}
            >
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 border border-border/50">
                  {getInitials(conversation.contact.name)}
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
                  <span className={cn(
                    "truncate text-sm font-medium",
                    selectedId === conversation.id ? "text-primary" : "text-card-foreground"
                  )}>
                    {conversation.contact.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground font-sans">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(conversation.lastMessageAt)}
                  </span>
                </div>

                <p className="mt-0.5 truncate text-xs text-muted-foreground font-sans">
                  {conversation.lastMessage}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {conversation.handledBy === "ai" ? (
                      <Bot className="h-3 w-3 text-primary" />
                    ) : (
                      <User className="h-3 w-3 text-blue-500" />
                    )}
                    <span className="text-xs text-muted-foreground font-sans">
                      {stateLabels[conversation.state] || conversation.state}
                    </span>
                  </div>

                  {conversation.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-bold text-foreground font-display">Nenhuma conversa real ainda</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Quando o webhook da UAZAPI receber mensagens desta instancia, elas aparecerao aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
