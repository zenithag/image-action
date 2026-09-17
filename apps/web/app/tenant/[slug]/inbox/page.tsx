"use client"

import { use, useEffect, useMemo, useState } from "react"
import type { InboxConversationSummary, InboxMessage } from "@/lib/inbox-types"
import { ChatPanel } from "@/components/chat-panel"
import { ConversationList } from "@/components/conversation-list"
import { useInboxRealtime } from "@/lib/inbox-realtime-client"
import { SafeImage } from "@/components/safe-image"
import { Bot, FileText, Image as ImageIcon, Mic, Phone, User, Video } from "lucide-react"

async function requestJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisição inválida."
    throw new Error(message)
  }

  return payload as T
}

function formatDateTime(value?: string) {
  if (!value) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function mediaLabel(contentType: InboxMessage["contentType"]) {
  if (contentType === "image") return "Imagem"
  if (contentType === "audio") return "Áudio"
  if (contentType === "video") return "Vídeo"
  if (contentType === "file") return "Arquivo"
  return "Mídia"
}

function mediaIcon(contentType: InboxMessage["contentType"]) {
  if (contentType === "image") return ImageIcon
  if (contentType === "audio") return Mic
  if (contentType === "video") return Video
  return FileText
}

function stateLabel(value?: InboxConversationSummary["state"]) {
  if (value === "awaiting_base_image") return "Solicitando foto"
  if (value === "collecting_preferences") return "Coletando preferências"
  if (value === "showing_options") return "Mostrando opções"
  if (value === "awaiting_selection") return "Aguardando seleção"
  if (value === "composing") return "Gerando imagem"
  if (value === "completed") return "Concluído"
  return "Aguardando"
}

function statusLabel(value?: InboxConversationSummary["status"]) {
  if (value === "waiting_customer") return "Aguardando cliente"
  if (value === "waiting_operator") return "Aguardando operador"
  if (value === "closed") return "Fechada"
  return "Aberta"
}

function sortInboxMessages(messages: InboxMessage[]) {
  return [...messages].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  )
}

function ContextPanel({
  tenantSlug,
  conversationId,
}: {
  tenantSlug: string
  conversationId: string | null
}) {
  const [conversation, setConversation] = useState<InboxConversationSummary | null>(null)
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [error, setError] = useState<string | null>(null)

  async function loadContext() {
    if (!conversationId) {
      setConversation(null)
      setMessages([])
      return
    }

    setError(null)

    try {
      const [conversationsData, messagesData] = await Promise.all([
        requestJson<InboxConversationSummary>(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}`),
        requestJson<InboxMessage[]>(`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(conversationId)}/messages`),
      ])

      setConversation(conversationsData)
      setMessages(messagesData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar contexto.")
    }
  }

  useEffect(() => {
    void loadContext()
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
      void loadContext()
    }, 8000)

    return () => window.clearInterval(intervalId)
  }, [tenantSlug, conversationId])

  const mediaMessages = useMemo(() => messages.filter((message) =>
    message.contentType === "image" || message.contentType === "audio" || message.contentType === "video" || message.contentType === "file"
  ), [messages])
  const imageMessages = mediaMessages.filter((message) => message.contentType === "image").slice(0, 4)
  const inboundMessages = messages.filter((message) => message.direction === "inbound")
  const outboundMessages = messages.filter((message) => message.direction === "outbound")

  if (!conversationId) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center bg-card p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
          <Bot className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-sm font-semibold text-card-foreground">Nenhuma conversa selecionada</h2>
        <p className="mt-1 text-xs text-muted-foreground">Selecione uma conversa para ver o contexto operacional.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-card">
      <div className="flex flex-col items-center gap-2 border-b border-border px-4 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
          <User className="h-7 w-7" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-card-foreground">{conversation?.contact.name || "Contato"}</p>
          <p className="text-xs text-muted-foreground">{conversation?.contact.phone || conversation?.externalContactId || "Sem telefone"}</p>
        </div>
      </div>

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="border-b border-border px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Estado da conversa
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Responsável</span>
            <span className="font-medium text-card-foreground">{conversation?.handledBy === "operator" ? "Operador" : "IA"}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-card-foreground">{statusLabel(conversation?.status)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Próxima etapa</span>
            <span className="font-medium text-card-foreground">{stateLabel(conversation?.state)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Canal</span>
            <span className="font-medium text-card-foreground">{conversation?.channelInstanceName || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Última atividade</span>
            <span className="font-medium text-card-foreground">{formatDateTime(conversation?.lastMessageAt)}</span>
          </div>
        </div>
      </div>

      <div className="border-b border-border px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Resumo operacional
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Mensagens", value: messages.length },
            { label: "Entrada", value: inboundMessages.length },
            { label: "Saída", value: outboundMessages.length },
            { label: "Mídias", value: mediaMessages.length },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-mono text-lg font-medium text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-border px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Mídias da conversa
        </h3>
        {imageMessages.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {imageMessages.map((message) => (
              <SafeImage
                key={message.id}
                src={`/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/media`}
                alt="Mídia da conversa"
                loading="lazy"
                decoding="async"
                className="aspect-square rounded-lg border border-border object-cover"
                fallbackLabel="Mídia indisponível"
                fallbackHint=""
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {mediaMessages.slice(0, 4).map((message) => {
              const Icon = mediaIcon(message.contentType)
              return (
                <div key={message.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-card-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {mediaLabel(message.contentType)}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(message.createdAt)}</span>
                </div>
              )
            })}
            {mediaMessages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-background px-3 py-5 text-center text-xs text-muted-foreground">
                Nenhuma mídia registrada nesta conversa.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Dados do contato
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Telefone</span>
            <span className="font-medium text-card-foreground">{conversation?.contact.phone || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ID externo</span>
            <span className="max-w-[180px] truncate font-medium text-card-foreground">{conversation?.externalContactId || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mensagens novas</span>
            <span className="font-medium text-card-foreground">{conversation?.unreadCount ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InboxPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [variant, setVariant] = useState<"classic" | "focus">("focus")
  const hasSelectedConversation = Boolean(selectedConversation)

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-5 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="font-mono text-[13px] font-semibold tracking-tight text-foreground">
              inbox
            </h1>
            <p className="text-[10px] leading-none text-muted-foreground">atendimento · {slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-[2px]">
          {([["classic", "classic"], ["focus", "focus"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setVariant(key)}
              className={`rounded px-3 py-1 text-[11px] font-medium transition-all ${
                variant === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {variant === "classic" ? (
        <div className="relative min-h-0 flex-1 overflow-hidden xl:grid xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          <aside className={hasSelectedConversation ? "hidden h-full min-h-0 overflow-hidden border-r border-border bg-card xl:block" : "h-full min-h-0 overflow-hidden border-r border-border bg-card xl:block"}>
            <ConversationList
              tenantSlug={slug}
              selectedId={selectedConversation}
              onSelect={setSelectedConversation}
            />
          </aside>
          <section className={hasSelectedConversation ? "h-full min-h-0 min-w-0 overflow-hidden" : "hidden h-full min-h-0 min-w-0 overflow-hidden xl:block"}>
            <ChatPanel
              tenantSlug={slug}
              conversationId={selectedConversation}
              onBackToList={() => setSelectedConversation(null)}
              onConversationDeleted={() => setSelectedConversation(null)}
            />
          </section>
          <aside className="hidden h-full min-h-0 overflow-hidden border-l border-border bg-card 2xl:block">
            <ContextPanel tenantSlug={slug} conversationId={selectedConversation} />
          </aside>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(290px,360px)_minmax(0,1fr)]">
          <aside className={hasSelectedConversation ? "hidden h-full min-h-0 overflow-hidden border-r border-border bg-card lg:block" : "h-full min-h-0 overflow-hidden border-r border-border bg-card lg:block"}>
              <ConversationList
                tenantSlug={slug}
                selectedId={selectedConversation}
                onSelect={setSelectedConversation}
              />
          </aside>
          <section className={hasSelectedConversation ? "h-full min-h-0 overflow-hidden" : "hidden h-full min-h-0 overflow-hidden lg:block"}>
            <ChatPanel
              tenantSlug={slug}
              conversationId={selectedConversation}
              onBackToList={() => setSelectedConversation(null)}
              onConversationDeleted={() => setSelectedConversation(null)}
            />
          </section>
        </div>
      )}
    </div>
  )
}
