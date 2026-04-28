"use client"

import { useEffect, useRef } from "react"

import type { InboxConversationSummary, InboxMessage } from "@/lib/inbox-types"

export type InboxRealtimeClientEvent =
  | {
      type: "message_created"
      tenantSlug: string
      conversationId: string
      conversation: InboxConversationSummary
      message: InboxMessage
    }
  | {
      type: "message_updated"
      tenantSlug: string
      conversationId: string
      message: InboxMessage
    }
  | {
      type: "conversation_updated"
      tenantSlug: string
      conversationId: string
      conversation: InboxConversationSummary
    }

export function useInboxRealtime(
  tenantSlug: string,
  onEvent: (event: InboxRealtimeClientEvent) => void
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!tenantSlug) return

    const source = new EventSource(`/api/tenant/${tenantSlug}/inbox/events`)
    const handleEvent = (event: MessageEvent<string>) => {
      try {
        onEventRef.current(JSON.parse(event.data) as InboxRealtimeClientEvent)
      } catch {
        // Ignore malformed SSE payloads and keep the stream alive.
      }
    }

    source.addEventListener("message_created", handleEvent)
    source.addEventListener("message_updated", handleEvent)
    source.addEventListener("conversation_updated", handleEvent)

    return () => {
      source.removeEventListener("message_created", handleEvent)
      source.removeEventListener("message_updated", handleEvent)
      source.removeEventListener("conversation_updated", handleEvent)
      source.close()
    }
  }, [tenantSlug])
}
