"use client"

import { ToggleButton } from "@/components/spectrum/toggle-button"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useConversationStore } from "@/lib/stores/conversation-store"
import { apiFetch } from "@/lib/api"
import type { Conversation } from "@studio/contracts"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const stateLabels: Record<string, string> = {
  idle: "Aguardando",
  awaiting_base_image: "Esperando imagem",
  collecting_preferences: "Coletando prefs",
  showing_options: "Mostrando opcoes",
  awaiting_selection: "Esperando selecao",
  composing: "Compondo",
  completed: "Concluida",
}

const handledByLabels: Record<string, string> = {
  ai: "IA",
  operator: "Operador",
}

export function ConversationList() {
  const { data: session } = useSession()
  const conversations = useConversationStore((s) => s.conversations)
  const setConversations = useConversationStore((s) => s.setConversations)
  const activeId = useConversationStore((s) => s.activeConversationId)
  const setActive = useConversationStore((s) => s.setActiveConversation)
  const [filter, setFilter] = useState<"all" | "ai" | "operator">("all")

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Conversation[]>("/v1/conversations", {
          accessToken: session?.accessToken,
        })
        setConversations(data)
      } catch {
        // silently fail — conversations will be empty
      }
    }
    load()
  }, [session?.accessToken, setConversations])

  const filtered = conversations.filter((c) => {
    if (filter === "all") return true
    return c.handled_by === filter
  })

  return (
    <div className="flex h-full flex-col border-r border-border bg-card/30">
      <div className="border-b border-border p-3">
        <h2 className="mb-3 font-display text-lg font-semibold">Conversas</h2>
        <div className="flex gap-1">
          {(["all", "ai", "operator"] as const).map((f) => (
            <ToggleButton selected={filter === f} key={f} onClick={() => setFilter(f)}>
              {f === "all" ? "Todas" : handledByLabels[f]}
            </ToggleButton>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((conv) => (
          <button
            key={conv.id}
            onClick={() => setActive(conv.id)}
            className={cn(
              "flex w-full flex-col gap-1 border-b border-border/50 px-4 py-3 text-left transition-colors",
              activeId === conv.id ? "bg-primary/5" : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground truncate">
                {conv.contact_id.slice(0, 12)}...
              </span>
              <Badge variant={conv.handled_by === "operator" ? "default" : "secondary"} className="text-xs">
                {handledByLabels[conv.handled_by]}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {stateLabels[conv.state] || conv.state}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
        )}
      </div>
    </div>
  )
}
