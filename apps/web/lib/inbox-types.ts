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

export type InboxCompositionSessionStep =
  | "idle"
  | "browsing_catalog"
  | "product_selected"
  | "awaiting_reference_image"
  | "awaiting_base_image"
  | "awaiting_base_choice"
  | "composing"
  | "completed"

export type InboxCompositionSessionImage = {
  kind: "base" | "result" | "reference"
  messageId?: string
  jobId?: string
  imageUrl?: string
  label?: string
  createdAt: string
}

export type InboxCompositionSessionProduct = {
  id?: string
  sku?: string
  name: string
  category?: string
  color?: string
}

export type InboxCompositionSessionChange = {
  id: string
  prompt: string
  product?: InboxCompositionSessionProduct
  base: "original" | "result" | "new_upload" | "unspecified"
  jobId?: string
  status: "pending" | "queued" | "done" | "failed"
  createdAt: string
  completedAt?: string
}

export type InboxCompositionSession = {
  step: InboxCompositionSessionStep
  baseImage?: InboxCompositionSessionImage
  referenceImage?: InboxCompositionSessionImage
  workingImage?: InboxCompositionSessionImage
  preferredBase?: "original" | "result"
  selectedProducts: InboxCompositionSessionProduct[]
  pendingPrompt?: string
  pendingBaseChoice?: boolean
  changes: InboxCompositionSessionChange[]
  updatedAt: string
}

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
  contextResetAt?: string
  compositionSession?: InboxCompositionSession
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
  status?: "sent" | "delivered" | "read" | "failed"
  rawPayload?: unknown
  createdAt: string
}
