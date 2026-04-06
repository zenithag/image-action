export type TenantStatus = "draft" | "active" | "suspended" | "archived"
export type DomainStatus = "pending_verification" | "verified" | "failed" | "disabled"
export type ChannelType = "whatsapp" | "instagram"
export type ChannelProvider = "uazapi" | "wuzapi"
export type ChannelStatus = "pending" | "connected" | "disconnected" | "error"
export type ConversationStatus = "open" | "waiting_customer" | "waiting_operator" | "closed"
export type ConversationState =
  | "idle"
  | "awaiting_base_image"
  | "collecting_preferences"
  | "showing_options"
  | "awaiting_selection"
  | "composing"
  | "completed"
export type HandledBy = "ai" | "operator"
export type MessageDirection = "inbound" | "outbound"
export type MessageRole = "customer" | "assistant" | "operator" | "system"
export type MessageContentType = "text" | "image" | "catalog_options" | "composition_result"
export type AssetRole = "reference" | "base_image" | "overlay" | "mask" | "render" | "attachment" | "catalog"
export type CatalogItemImageRole = "primary" | "swatch" | "applied_example"
export type Mode = "product" | "interior" | "print" | "fashion"
export type JobStatus = "queued" | "processing" | "done" | "failed"

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan_code: string
}

export type TenantDomain = {
  id: string
  tenant_id: string
  hostname: string
  is_primary: boolean
  status: DomainStatus
}

export type TenantChannel = {
  id: string
  tenant_id: string
  channel_type: ChannelType
  provider: ChannelProvider
  external_session_id: string
  status: ChannelStatus
}

export type Contact = {
  id: string
  tenant_id: string
  external_contact_id: string
  display_name: string
  phone?: string | null
}

export type Conversation = {
  id: string
  tenant_id: string
  channel_id: string
  contact_id: string
  status: ConversationStatus
  state: ConversationState
  handled_by: HandledBy
  operator_id?: string | null
}

export type Message = {
  id: string
  tenant_id: string
  conversation_id: string
  direction: MessageDirection
  role: MessageRole
  content: string
  content_type: MessageContentType
  provider_message_id?: string | null
}

export type Asset = {
  id: string
  tenant_id: string
  conversation_id?: string | null
  role: AssetRole
  mime_type: string
  storage_key: string
  metadata: Record<string, unknown>
}

export type CatalogCategory = {
  id: string
  tenant_id: string
  name: string
  parent_id?: string | null
  sort_order: number
}

export type CatalogItem = {
  id: string
  tenant_id: string
  category_id: string
  name: string
  description: string
  sku?: string | null
  status: "active" | "inactive"
  tags: Record<string, string>
}

export type CatalogItemImage = {
  id: string
  tenant_id: string
  catalog_item_id: string
  asset_id: string
  role: CatalogItemImageRole
  sort_order: number
}

export type CompositionJob = {
  id: string
  tenant_id: string
  conversation_id: string
  mode: Mode
  status: JobStatus
  catalog_item_id?: string | null
  base_asset_id: string
  overlay_asset_id?: string | null
  mask_asset_id?: string | null
  input_payload: Record<string, unknown>
  error_message?: string | null
}

export type Render = {
  id: string
  tenant_id: string
  job_id: string
  asset_id: string
  version: number
}

export type UsageEvent = {
  id: string
  tenant_id: string
  kind: string
  provider: string
  reference_id?: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  metadata: Record<string, unknown>
}

// --- Channel Events ---

export type InboundMediaItem = {
  mime_type: string
  url: string
  caption?: string | null
  kind: "image" | "audio" | "video" | "document"
}

export type InboundChannelMessage = {
  external_message_id: string
  external_contact_id: string
  contact_name: string
  phone?: string | null
  text?: string | null
  media: InboundMediaItem[]
  tenant_id?: string | null
  channel_id?: string | null
}

export type TenantResolution = {
  tenant_id: string
  channel_id: string
  resolved_by: "session_lookup" | "payload_override"
}

export type InboundChannelEvent = {
  provider: ChannelProvider
  tenant: TenantResolution
  message: InboundChannelMessage
  media: InboundMediaItem[]
  normalized_type: "text" | "image" | "audio" | "video" | "document" | "mixed" | "unknown"
  raw_payload: Record<string, unknown>
}

// --- Orchestrator ---

export type Intent = "visual_edit" | "commercial_question" | "smalltalk" | "human_handoff"
export type NextAction =
  | "reply_in_chat"
  | "ask_for_base_image"
  | "ask_for_reference_image"
  | "create_composition_job"
  | "handoff_to_operator"
  | "show_catalog_options"

export type ClassificationResponse = {
  intent: Intent
  mode?: Mode | null
  next_action: NextAction
  confidence: number
  needs_human_review: boolean
  missing_inputs: string[]
  rationale: string
  source: "heuristic" | "openrouter"
}

// --- WebSocket Events ---

export type WsEventType = "new_message" | "job_update" | "conversation_update"

export type WsNewMessage = {
  type: "new_message"
  data: {
    conversation_id: string
    message: Message
  }
}

export type WsJobUpdate = {
  type: "job_update"
  data: {
    job_id: string
    conversation_id: string
    status: JobStatus
    render_url?: string | null
  }
}

export type WsConversationUpdate = {
  type: "conversation_update"
  data: {
    conversation_id: string
    handled_by: HandledBy
    operator_id?: string | null
    state: ConversationState
  }
}

export type WsEvent = WsNewMessage | WsJobUpdate | WsConversationUpdate
