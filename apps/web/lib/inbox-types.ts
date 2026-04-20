export type InboxHandledBy = "ai" | "operator"
export type InboxConversationStatus = "open" | "waiting_customer" | "waiting_operator" | "closed"
export type InboxConversationState =
  | "idle"
  | "awaiting_base_image"
  | "collecting_preferences"
  | "showing_options"
  | "awaiting_selection"
  | "composing"
  | "completed"

export type InboxMessageRole = "customer" | "assistant" | "operator" | "system"
export type InboxMessageDirection = "inbound" | "outbound"
export type InboxMessageContentType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "catalog_options"
  | "composition_result"

export type InboxConversationSummary = {
  id: string
  tenantSlug: string
  channelInstanceId: string
  channelInstanceName: string
  externalContactId: string
  contact: {
    name: string
    phone?: string
    avatar?: string
  }
  lastMessage: string
  lastMessageAt: string
  status: InboxConversationStatus
  handledBy: InboxHandledBy
  unreadCount: number
  state: InboxConversationState
  createdAt: string
  updatedAt: string
}

export type InboxMessage = {
  id: string
  tenantSlug: string
  conversationId: string
  channelInstanceId: string
  externalContactId: string
  direction: InboxMessageDirection
  role: InboxMessageRole
  content: string
  contentType: InboxMessageContentType
  imageUrl?: string
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaSize?: number
  mediaDurationSeconds?: number
  providerMessageId?: string
  status?: "sent" | "delivered" | "read"
  rawPayload?: unknown
  createdAt: string
}
