import type { InboxConversationSummary, InboxMessage } from "@/lib/inbox-types"

export type InboxRealtimeEvent =
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
  | {
      type: "conversation_deleted"
      tenantSlug: string
      conversationId: string
    }

type InboxRealtimeListener = (event: InboxRealtimeEvent) => void

type InboxRealtimeGlobal = typeof globalThis & {
  __inboxRealtimeListeners?: Map<string, Set<InboxRealtimeListener>>
}

function getListeners() {
  const globalStore = globalThis as InboxRealtimeGlobal
  globalStore.__inboxRealtimeListeners ??= new Map()

  return globalStore.__inboxRealtimeListeners
}

export function subscribeInboxRealtime(tenantSlug: string, listener: InboxRealtimeListener) {
  const listeners = getListeners()
  const tenantListeners = listeners.get(tenantSlug) ?? new Set<InboxRealtimeListener>()

  tenantListeners.add(listener)
  listeners.set(tenantSlug, tenantListeners)

  return () => {
    tenantListeners.delete(listener)

    if (tenantListeners.size === 0) {
      listeners.delete(tenantSlug)
    }
  }
}

export function publishInboxRealtime(event: InboxRealtimeEvent) {
  const tenantListeners = getListeners().get(event.tenantSlug)

  if (!tenantListeners?.size) {
    return
  }

  for (const listener of tenantListeners) {
    try {
      listener(event)
    } catch (error) {
      console.error("Inbox realtime listener failed", error)
    }
  }
}
