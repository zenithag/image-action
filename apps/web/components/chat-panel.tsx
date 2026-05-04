"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { InboxConversationSummary, InboxMessage } from "@/lib/inbox-types"
import { useInboxRealtime } from "@/lib/inbox-realtime-client"
import type { StudioDraft, StudioImageSlot } from "@/lib/studio-draft"
import { getStudioDraftStorageKey } from "@/lib/studio-draft"
import {
  AlertCircle,
  Bot,
  CheckCheck,
  Download,
  Eraser,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
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
import { SafeImage } from "@/components/safe-image"

interface ChatPanelProps {
  tenantSlug: string
  conversationId?: string | null
  onBackToList?: () => void
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

function sortInboxMessages(messages: InboxMessage[]) {
  return [...messages].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  )
}

function formatMediaSize(size?: number) {
  if (!size || !Number.isFinite(size)) return ""
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function getInboxMessageMediaUrl(tenantSlug: string, message: InboxMessage) {
  return `/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/media`
}

function addStudioReference(draft: StudioDraft, artifact: StudioDraft["baseImage"]) {
  if (!artifact) return draft.references ?? []

  const currentReferences = draft.references ?? (draft.referenceImage ? [draft.referenceImage] : [])
  const key = artifact.messageId ? `inbox:${artifact.messageId}` : artifact.mediaUrl
  const exists = currentReferences.some((reference) => {
    const referenceKey = reference.messageId ? `inbox:${reference.messageId}` : reference.mediaUrl
    return referenceKey === key
  })

  return exists ? currentReferences : [...currentReferences, artifact]
}

function MediaMessage({
  message,
  tenantSlug,
  onSendToStudio,
}: {
  message: InboxMessage
  tenantSlug: string
  onSendToStudio?: (message: InboxMessage, slot: StudioImageSlot) => void
}) {
  const mediaUrl = getInboxMessageMediaUrl(tenantSlug, message)
  const caption = shouldShowMediaCaption(message) ? message.content : ""

  if (message.contentType === "image") {
    return (
      <div className="space-y-2">
        <SafeImage
          src={mediaUrl}
          alt={caption || "Imagem enviada"}
          loading="lazy"
          decoding="async"
          className="h-auto max-h-[360px] max-w-full rounded-lg border-0 object-contain outline-none"
          fallbackClassName="min-h-44 w-72 max-w-full"
          fallbackLabel="Imagem indisponível"
          fallbackHint="A mídia pode ter expirado no WhatsApp."
        />
        {caption && <p className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{caption}</p>}
        {onSendToStudio && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onSendToStudio(message, "base")}
              className="rounded-full border border-current/15 bg-background/75 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-background"
            >
              Usar como ambiente
            </button>
            <button
              type="button"
              onClick={() => onSendToStudio(message, "reference")}
              className="rounded-full border border-current/15 bg-background/75 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 transition-colors hover:bg-background"
            >
              Usar como referência
            </button>
          </div>
        )}
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

export function ChatPanel({ tenantSlug, conversationId, onBackToList }: ChatPanelProps) {
  const router = useRouter()
  const [conversation, setConversation] = useState<InboxConversationSummary | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isTakingOver, setIsTakingOver] = useState(false)
  const [isReturningToAi, setIsReturningToAi] = useState(false)
  const [isResettingContext, setIsResettingContext] = useState(false)
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
      const [conversationResponse, messagesResponse] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}`, { cache: "no-store" }),
        fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, { cache: "no-store" }),
      ])

      if (!conversationResponse.ok || !messagesResponse.ok) {
        throw new Error("Nao foi possivel carregar a conversa.")
      }

      const nextConversation = await conversationResponse.json() as InboxConversationSummary
      const nextMessages = await messagesResponse.json() as InboxMessage[]
      setConversation(nextConversation)
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

  useInboxRealtime(tenantSlug, (event) => {
    if (!conversationId || event.conversationId !== conversationId) {
      return
    }

    if ("conversation" in event) {
      setConversation(event.conversation)
    }

    if (event.type === "message_created") {
      setMessages((current) => {
        if (current.some((item) => item.id === event.message.id)) {
          return current
        }

        return sortInboxMessages([...current, event.message])
      })
    }

    if (event.type === "message_updated") {
      setMessages((current) =>
        current.map((item) => item.id === event.message.id ? event.message : item)
      )
    }
  })

  useEffect(() => {
    if (!conversationId) return

    const intervalId = window.setInterval(() => {
      void loadConversation({ silent: true })
    }, 6000)

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

  async function resetConversationContext() {
    if (!conversationId || isResettingContext) return

    setIsResettingContext(true)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/context/reset`, {
        method: "POST",
      })
      const payload = await response.json().catch(() => null) as InboxConversationSummary | { error?: string } | null

      if (!response.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel limpar o contexto da IA.")
      }

      if (payload && "id" in payload) {
        setConversation(payload)
      }
      void loadConversation({ silent: true })
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Erro ao limpar contexto.")
    } finally {
      setIsResettingContext(false)
    }
  }

  function sendImageToStudio(selectedMessage: InboxMessage, slot: StudioImageSlot) {
    if (selectedMessage.contentType !== "image") return

    try {
      const storageKey = getStudioDraftStorageKey(tenantSlug)
      const storedDraft = window.localStorage.getItem(storageKey)
      const currentDraft = storedDraft ? JSON.parse(storedDraft) as StudioDraft : {}
      const artifact = {
        source: "inbox" as const,
        conversationId: selectedMessage.conversationId,
        channelInstanceId: selectedMessage.channelInstanceId,
        messageId: selectedMessage.id,
        mediaUrl: getInboxMessageMediaUrl(tenantSlug, selectedMessage),
        caption: shouldShowMediaCaption(selectedMessage) ? selectedMessage.content : undefined,
        contactName: conversation?.contact.name ?? currentContactName,
        contactPhone: currentPhone || undefined,
        createdAt: selectedMessage.createdAt,
      }
      const nextDraft: StudioDraft = {
        ...currentDraft,
        ...(slot === "base" ? { baseImage: artifact } : {
          referenceImage: artifact,
          references: addStudioReference(currentDraft, artifact),
        }),
        updatedAt: new Date().toISOString(),
      }

      window.localStorage.setItem(storageKey, JSON.stringify(nextDraft))
      router.push(`/tenant/${tenantSlug}/editor`)
    } catch {
      setError("Nao foi possivel enviar a imagem para o Estudio.")
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onBackToList && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 lg:hidden"
              onClick={onBackToList}
              aria-label="Voltar para conversas"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-secondary text-sm font-bold text-secondary-foreground">
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

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {conversation?.handledBy === "operator" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs font-sans sm:px-3"
              onClick={returnConversationToAi}
              disabled={isReturningToAi || isTakingOver || !conversation}
              title="Devolver para IA"
            >
              {isReturningToAi ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Bot className="h-3.5 w-3.5 sm:mr-1.5" />}
              <span className="hidden sm:inline">Devolver para IA</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 px-2 text-xs font-sans sm:px-3"
              onClick={takeoverConversation}
              disabled={isTakingOver || isReturningToAi || !conversation}
              title="Assumir conversa"
            >
              {isTakingOver ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <User className="h-3.5 w-3.5 sm:mr-1.5" />}
              <span className="hidden sm:inline">Assumir conversa</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-2 text-xs font-sans sm:px-3"
            onClick={resetConversationContext}
            disabled={isResettingContext || !conversation}
            title="Mantem as mensagens visiveis, mas faz a IA ignorar o historico anterior."
          >
            {isResettingContext ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Eraser className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Limpar contexto</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => loadConversation()}
            title="Atualizar conversa"
            aria-label="Atualizar conversa"
          >
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
                  msg.direction === "inbound" ? "justify-start" : "justify-end",
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
                      "relative max-w-[85%] px-3 py-1.5 shadow-sm",
                      msg.direction === "inbound"
                        ? "bg-[var(--chat-bubble-in)] text-[#111b21] dark:text-foreground rounded-r-xl rounded-bl-xl"
                        : "bg-[var(--chat-bubble-out)] text-[var(--chat-bubble-out-foreground)] rounded-l-xl rounded-br-xl"
                    )}
                    style={{ borderRadius: msg.direction === "inbound" ? "0 10px 10px 10px" : "10px 0 10px 10px" }}
                  >
                    {msg.direction === "outbound" && (
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold text-current/80 font-sans">
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
                    {msg.direction === "inbound" && (
                      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground font-sans">
                        <User className="h-3 w-3" />
                        <span>Cliente</span>
                      </div>
                    )}

                    <div className="flex flex-col">
                      <MediaMessage
                        message={msg}
                        tenantSlug={tenantSlug}
                        onSendToStudio={msg.contentType === "image" ? sendImageToStudio : undefined}
                      />
                      <div className={cn(
                        "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                        msg.direction === "outbound" ? "text-current/70" : "text-muted-foreground"
                      )}>
                        <span>{formatMessageTime(msg.createdAt)}</span>
                        {msg.direction === "outbound" && msg.status === "failed" && (
                          <span className="inline-flex items-center gap-1 font-medium text-destructive" title="Nao enviado ao WhatsApp">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Nao enviado
                          </span>
                        )}
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
