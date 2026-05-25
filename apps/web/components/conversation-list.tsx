"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { InboxConversationSummary, InboxHandledBy } from "@/lib/inbox-types"
import { useInboxRealtime } from "@/lib/inbox-realtime-client"
import { Bot, Clock, MessageSquare, RefreshCw, Trash2, User } from "lucide-react"

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

function sortConversationSummaries(conversations: InboxConversationSummary[]) {
  return [...conversations].sort(
    (left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
  )
}

export function ConversationList({ tenantSlug, selectedId, onSelect }: ConversationListProps) {
  const [conversations, setConversations] = useState<InboxConversationSummary[]>([])
  const [filter, setFilter] = useState<"all" | InboxHandledBy | "unread">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedIdRef = useRef(selectedId)

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  async function triggerInboxSync(options?: { wait?: boolean; fast?: boolean }) {
    const params = new URLSearchParams()

    if (options?.wait) params.set("wait", "1")
    if (options?.fast) params.set("fast", "1")

    await fetch(`/api/tenant/${tenantSlug}/inbox/sync${params.size ? `?${params.toString()}` : ""}`, {
      method: "POST",
    }).catch(() => null)
  }

  async function loadConversations(options?: { silent?: boolean; sync?: boolean; waitForSync?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true)
      setError(null)
    }

    try {
      if (options?.sync) {
        await triggerInboxSync({ wait: options.waitForSync, fast: true })
      }

      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar as conversas.")
      }

      const data = await response.json() as InboxConversationSummary[]
      setConversations(data)
      window.dispatchEvent(new CustomEvent("inbox:unread-changed"))

      const currentSelectedId = selectedIdRef.current

      if (!currentSelectedId && data[0]) {
        selectedIdRef.current = data[0].id
        onSelect?.(data[0].id)
      }

      if (currentSelectedId && !data.some((conversation) => conversation.id === currentSelectedId)) {
        selectedIdRef.current = data[0]?.id ?? null
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

  async function deleteConversation(conversation: InboxConversationSummary) {
    const confirmed = window.confirm(
      `Excluir a conversa com ${conversation.contact.name}? As composicoes geradas por esta conversa serao mantidas no historico.`
    )

    if (!confirmed) {
      return
    }

    setDeletingConversationId(conversation.id)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversation.id)}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel excluir a conversa.")
      }

      setConversations((current) => current.filter((item) => item.id !== conversation.id))

      if (selectedIdRef.current === conversation.id) {
        selectedIdRef.current = null
        onSelect?.(null)
      }

      window.dispatchEvent(new CustomEvent("inbox:unread-changed"))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir conversa.")
    } finally {
      setDeletingConversationId(null)
    }
  }

  useEffect(() => {
    void loadConversations({ sync: true })
  }, [tenantSlug])

  useInboxRealtime(tenantSlug, (event) => {
    if (event.type === "conversation_deleted") {
      setConversations((current) => current.filter((conversation) => conversation.id !== event.conversationId))

      if (selectedIdRef.current === event.conversationId) {
        selectedIdRef.current = null
        onSelect?.(null)
      }

      window.dispatchEvent(new CustomEvent("inbox:unread-changed"))
      return
    }

    if (!("conversation" in event)) {
      return
    }

    setConversations((current) => {
      const exists = current.some((conversation) => conversation.id === event.conversation.id)
      const nextConversations = exists
        ? current.map((conversation) => conversation.id === event.conversation.id ? event.conversation : conversation)
        : [event.conversation, ...current]

      return sortConversationSummaries(nextConversations)
    })
    window.dispatchEvent(new CustomEvent("inbox:unread-changed"))

    if (!selectedId) {
      selectedIdRef.current = event.conversation.id
      onSelect?.(event.conversation.id)
    }
  })

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void triggerInboxSync({ fast: true })
      }

      void loadConversations({ silent: true })
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [tenantSlug, selectedId])

  const filteredConversations = useMemo(() => {
    if (filter === "all") return conversations
    if (filter === "unread") return conversations.filter((c) => c.unreadCount > 0)
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
              onClick={() => loadConversations({ sync: true, waitForSync: true })}
              className="rounded-[10px] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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

      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2">
        {[
          { id: "all", label: "Todas" },
          { id: "ai", label: "IA" },
          { id: "operator", label: "Operador" },
          { id: "unread", label: "Não lidas" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id as "all" | InboxHandledBy | "unread")}
            className={cn(
              "min-w-fit flex-1 rounded-md px-3 py-1.5 text-xs transition-colors",
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
            <div
              key={conversation.id}
              className={cn(
                "relative border-b border-border transition-all duration-200",
                selectedId === conversation.id
                  ? "bg-primary/10"
                  : "bg-transparent hover:bg-primary/5"
              )}
            >
              {selectedId === conversation.id && (
                <span className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r bg-primary" />
              )}
              <button
                type="button"
                onClick={() => {
                  selectedIdRef.current = conversation.id
                  onSelect?.(conversation.id)
                  void markConversationAsRead(conversation.id)
                }}
                className="flex w-full items-start gap-3 p-4 pr-12 text-left"
              >
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-secondary text-sm font-bold text-secondary-foreground">
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
                    <span className="flex max-w-[92px] shrink-0 items-center gap-1 truncate text-xs text-muted-foreground font-sans">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(conversation.lastMessageAt)}
                    </span>
                  </div>

                  <p className="mt-0.5 truncate text-xs text-muted-foreground font-sans">
                    {conversation.lastMessage}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-1.5">
                      {conversation.handledBy === "ai" ? (
                        <Bot className="h-3 w-3 text-primary" />
                      ) : (
                        <User className="h-3 w-3 text-blue-500" />
                      )}
                      <span className="truncate text-xs text-muted-foreground font-sans">
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

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  void deleteConversation(conversation)
                }}
                disabled={deletingConversationId === conversation.id}
                className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                title="Excluir conversa"
                aria-label={`Excluir conversa com ${conversation.contact.name}`}
              >
                <Trash2
                  className={cn(
                    "h-4 w-4",
                    deletingConversationId === conversation.id && "animate-pulse"
                  )}
                />
              </button>
            </div>
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
