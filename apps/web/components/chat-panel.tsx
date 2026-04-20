"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { InboxConversationSummary, InboxMessage } from "@/lib/inbox-types"
import {
  Bot,
  CheckCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  MoreVertical,
  Paperclip,
  Phone,
  RefreshCw,
  Send,
  User,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatPanelProps {
  tenantSlug: string
  conversationId?: string | null
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WA"
}

function getMediaLabel(contentType: InboxMessage["contentType"]) {
  if (contentType === "image") return "Imagem recebida"
  if (contentType === "audio") return "Audio recebido"
  if (contentType === "video") return "Video recebido"
  if (contentType === "file") return "Arquivo recebido"

  return ""
}

function shouldShowMediaCaption(message: InboxMessage) {
  const label = getMediaLabel(message.contentType)
  return Boolean(message.content && message.content !== label)
}

function formatMediaSize(size?: number) {
  if (!size || !Number.isFinite(size)) return ""
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function MediaMessage({ message, tenantSlug }: { message: InboxMessage; tenantSlug: string }) {
  const mediaUrl = `/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/media`
  const caption = shouldShowMediaCaption(message) ? message.content : ""

  if (message.contentType === "image") {
    return (
      <div className="space-y-2">
        <img
          src={mediaUrl}
          alt={caption || "Imagem enviada"}
          className="h-auto max-h-[360px] max-w-full rounded-lg border-0 object-contain outline-none"
        />
        {caption && <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{caption}</p>}
      </div>
    )
  }

  if (message.contentType === "audio") {
    return (
      <div className="min-w-64 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-primary/80 font-sans">
          <Mic className="h-3.5 w-3.5" />
          <span>Audio</span>
          {message.mediaDurationSeconds ? <span>{Math.round(message.mediaDurationSeconds)}s</span> : null}
        </div>
        <audio controls src={mediaUrl} className="w-full" />
        {caption && <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{caption}</p>}
      </div>
    )
  }

  if (message.contentType === "video") {
    return (
      <div className="space-y-2">
        <video controls src={mediaUrl} className="max-h-[360px] max-w-full rounded-lg bg-black" />
        {caption && <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{caption}</p>}
      </div>
    )
  }

  if (message.contentType === "file") {
    return (
      <div className="space-y-2">
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-64 items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-3 text-foreground transition-colors hover:bg-background"
        >
          <FileText className="h-6 w-6 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {message.mediaFileName || "Arquivo recebido"}
            </span>
            <span className="block text-xs text-muted-foreground">
              {[message.mediaMimeType, formatMediaSize(message.mediaSize)].filter(Boolean).join(" - ") || "Sem metadados"}
            </span>
          </span>
          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
        {caption && <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{caption}</p>}
      </div>
    )
  }

  return <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{message.content}</p>
}

export function ChatPanel({ tenantSlug, conversationId }: ChatPanelProps) {
  const [conversation, setConversation] = useState<InboxConversationSummary | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isTakingOver, setIsTakingOver] = useState(false)
  const [isReturningToAi, setIsReturningToAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const hasConversation = Boolean(conversationId)
  const currentContactName = conversation?.contact.name ?? "Contato"
  const currentPhone = conversation?.contact.phone ?? conversation?.externalContactId ?? ""
  const isAiActive = conversation?.handledBy === "ai"

  const headerStatus = useMemo(() => {
    if (!conversation) return "Operador"
    return conversation.handledBy === "operator" ? "Operador ativo" : "IA ativa"
  }, [conversation])

  async function loadConversation(options?: { silent?: boolean }) {
    if (!conversationId) {
      setConversation(null)
      setMessages([])
      return
    }

    if (!options?.silent) {
      setIsLoading(true)
      setError(null)
    }

    try {
      await fetch(`/api/tenant/${tenantSlug}/inbox/sync`, {
        method: "POST",
      }).catch(() => null)
      await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/read`, {
        method: "POST",
      }).catch(() => null)
      window.dispatchEvent(new CustomEvent("inbox:unread-changed"))

      const [conversationsResponse, messagesResponse] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/inbox/conversations`, { cache: "no-store" }),
        fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, { cache: "no-store" }),
      ])

      if (!conversationsResponse.ok || !messagesResponse.ok) {
        throw new Error("Nao foi possivel carregar a conversa.")
      }

      const conversations = await conversationsResponse.json() as InboxConversationSummary[]
      const nextMessages = await messagesResponse.json() as InboxMessage[]
      setConversation(conversations.find((item) => item.id === conversationId) ?? null)
      setMessages(nextMessages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar conversa.")
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadConversation()
  }, [tenantSlug, conversationId])

  useEffect(() => {
    if (!conversationId) return

    const intervalId = window.setInterval(() => {
      void loadConversation({ silent: true })
    }, 3000)

    return () => window.clearInterval(intervalId)
  }, [tenantSlug, conversationId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length])

  async function sendMessage() {
    const text = message.trim()
    if (!text || !conversationId || isSending) return

    if (isAiActive) {
      setError("A IA esta ativa nesta conversa. Assuma a conversa antes de responder como operador.")
      return
    }

    setIsSending(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const payload = await response.json().catch(() => null) as InboxMessage | { error?: string } | null

      if (!response.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel enviar a mensagem.")
      }

      setMessage("")
      if (payload && "id" in payload) {
        setMessages((current) => [...current, payload])
      }
      void loadConversation({ silent: true })
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Erro ao enviar mensagem.")
    } finally {
      setIsSending(false)
    }
  }

  async function takeoverConversation() {
    if (!conversationId || isTakingOver || isReturningToAi) return

    setIsTakingOver(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/takeover`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null) as InboxConversationSummary | { error?: string } | null

      if (!response.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel assumir a conversa.")
      }

      if (payload && "id" in payload) {
        setConversation(payload)
      }
    } catch (takeoverError) {
      setError(takeoverError instanceof Error ? takeoverError.message : "Erro ao assumir conversa.")
    } finally {
      setIsTakingOver(false)
    }
  }

  async function returnConversationToAi() {
    if (!conversationId || isReturningToAi || isTakingOver) return

    setIsReturningToAi(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/ai/handoff`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null) as {
        conversation?: InboxConversationSummary
        aiResult?: { error?: string; skipped?: string }
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel devolver a conversa para a IA.")
      }

      if (payload?.conversation) {
        setConversation(payload.conversation)
      }
      void loadConversation({ silent: true })
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "Erro ao devolver conversa para a IA.")
    } finally {
      setIsReturningToAi(false)
    }
  }

  if (!hasConversation) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden bg-background p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-foreground font-display">Selecione uma conversa</h3>
        <p className="mt-1 text-center text-sm text-muted-foreground font-sans">
          As mensagens reais recebidas pela UAZAPI aparecerao na lista.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900 border border-border/50">
            {getInitials(currentContactName)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-medium text-foreground font-display">{currentContactName}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-sans">
              {currentPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {currentPhone.startsWith("+") ? currentPhone : `+${currentPhone}`}
                </span>
              )}
              <span className="flex items-center gap-1">
                {conversation?.handledBy === "ai" ? (
                  <Bot className="h-3 w-3 text-primary" />
                ) : (
                  <User className="h-3 w-3 text-blue-500" />
                )}
                {headerStatus}
              </span>
              {conversation?.channelInstanceName && <span>{conversation.channelInstanceName}</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {conversation?.handledBy === "operator" ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs font-sans"
              onClick={returnConversationToAi}
              disabled={isReturningToAi || isTakingOver || !conversation}
            >
              {isReturningToAi ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bot className="mr-1.5 h-3.5 w-3.5" />}
              Devolver para IA
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs font-sans"
              onClick={takeoverConversation}
              disabled={isTakingOver || isReturningToAi || !conversation}
            >
              {isTakingOver ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <User className="mr-1.5 h-3.5 w-3.5" />}
              Assumir conversa
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => loadConversation()}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-hide"
        style={{ backgroundColor: "var(--chat-bg)" }}
      >
        <div className="mx-auto w-full max-w-4xl space-y-4">
          {isLoading && messages.length === 0 ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando mensagens...
            </div>
          ) : messages.length > 0 ? (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.direction === "inbound" ? "justify-end" : "justify-start",
                  msg.role === "system" && "justify-center"
                )}
              >
                {msg.role === "system" ? (
                  <div className="flex items-center gap-2 rounded-lg bg-card/50 px-4 py-1.5 text-[11px] text-muted-foreground font-sans uppercase tracking-wider">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {msg.content}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "relative max-w-[85%] px-3 py-1.5 shadow-sm text-[#111b21] dark:text-foreground",
                      msg.direction === "inbound"
                        ? "bg-[var(--chat-bubble-out)] rounded-l-xl rounded-br-xl"
                        : "bg-[var(--chat-bubble-in)] rounded-r-xl rounded-bl-xl"
                    )}
                    style={{ borderRadius: msg.direction === "inbound" ? "10px 0 10px 10px" : "0 10px 10px 10px" }}
                  >
                    {msg.direction === "outbound" && (
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold text-primary/80 font-sans">
                        {msg.role === "assistant" ? (
                          <>
                            <Bot className="h-3 w-3" />
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

                    <div className="flex flex-col">
                      <MediaMessage message={msg} tenantSlug={tenantSlug} />
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {msg.direction === "outbound" && msg.status === "read" && (
                          <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Ainda nao ha mensagens nesta conversa.
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background p-4">
        {isAiActive && (
          <div className="mx-auto mb-3 flex max-w-4xl items-center gap-2 rounded-[6px] border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
            <Bot className="h-4 w-4 shrink-0" />
            <span>A IA esta respondendo esta conversa. Para enviar manualmente, clique em "Assumir conversa".</span>
          </div>
        )}
        <form
          className="mx-auto flex max-w-4xl items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void sendMessage()
          }}
        >
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" disabled>
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" disabled>
            <ImageIcon className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={isAiActive ? "IA ativa. Assuma a conversa para responder como operador." : "Digite uma mensagem como operador..."}
              rows={1}
              className="w-full resize-none rounded-lg border border-input bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-sans"
              disabled={isSending || !conversation || isAiActive}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
            />
          </div>

          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isSending || !message.trim() || !conversation || isAiActive}>
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
