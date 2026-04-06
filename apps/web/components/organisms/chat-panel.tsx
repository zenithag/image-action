"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useConversationStore } from "@/lib/stores/conversation-store"
import { apiFetch } from "@/lib/api"
import type { Message } from "@studio/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Send, UserCheck, Bot } from "lucide-react"

export function ChatPanel() {
  const { data: session } = useSession()
  const activeId = useConversationStore((s) => s.activeConversationId)
  const conversations = useConversationStore((s) => s.conversations)
  const messages = useConversationStore((s) => s.messages)
  const setMessages = useConversationStore((s) => s.setMessages)
  const updateConversation = useConversationStore((s) => s.updateConversation)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find((c) => c.id === activeId)
  const activeMessages = activeId ? messages[activeId] || [] : []

  useEffect(() => {
    if (!activeId) return
    async function loadMessages() {
      try {
        const data = await apiFetch<Message[]>(`/v1/conversations/${activeId}/messages`, {
          accessToken: session?.accessToken,
        })
        setMessages(activeId!, data)
      } catch {
        // API may not have this endpoint yet — use empty array
      }
    }
    loadMessages()
  }, [activeId, session?.accessToken, setMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [activeMessages.length])

  async function handleSend() {
    if (!input.trim() || !activeId || sending) return
    setSending(true)
    try {
      await apiFetch(`/v1/conversations/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: input }),
        accessToken: session?.accessToken,
      })
      setInput("")
    } catch {
      // handle error silently
    } finally {
      setSending(false)
    }
  }

  async function handleTakeover() {
    if (!activeId) return
    await apiFetch(`/v1/conversations/${activeId}/takeover`, {
      method: "POST",
      accessToken: session?.accessToken,
    })
    updateConversation(activeId, { handled_by: "operator" })
  }

  async function handleRelease() {
    if (!activeId) return
    await apiFetch(`/v1/conversations/${activeId}/release`, {
      method: "POST",
      accessToken: session?.accessToken,
    })
    updateConversation(activeId, { handled_by: "ai" })
  }

  if (!activeId || !activeConv) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>Selecione uma conversa para iniciar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{activeConv.contact_id.slice(0, 16)}...</span>
          <Badge variant="secondary" className="text-[10px]">{activeConv.state}</Badge>
        </div>
        <div className="flex gap-2">
          {activeConv.handled_by === "ai" ? (
            <Button size="sm" variant="outline" onClick={handleTakeover}>
              <UserCheck className="mr-1 size-3" />
              Assumir
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleRelease}>
              <Bot className="mr-1 size-3" />
              Devolver p/ IA
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
        {activeMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
              msg.direction === "inbound"
                ? "self-start bg-muted text-foreground"
                : "self-end bg-primary text-primary-foreground ml-auto"
            )}
          >
            <p className="text-xs font-medium opacity-70 mb-1">
              {msg.role === "customer" ? "Cliente" : msg.role === "operator" ? "Operador" : "Assistente"}
            </p>
            <p>{msg.content}</p>
          </div>
        ))}
        {activeMessages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Sem mensagens ainda.</p>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
