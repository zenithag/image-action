export type ConversationFlowStatus = "draft" | "published"
export type ConversationFlowScope = "tenant"
export type ConversationFlowSessionStatus = "active" | "waiting" | "paused" | "completed" | "failed"
export type ConversationFlowEventStatus = "ok" | "skipped" | "failed"

export type ConversationFlowNodeType =
  | "start"
  | "content"
  | "menu"
  | "action"
  | "condition"
  | "flow_connection"
  | "randomizer"
  | "smart_delay"
  | "scenario_image"
  | "reference_image"
  | "create_composition"

export type ConversationFlowContentType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "contact"
  | "delay"
  | "wait"
  | "typing"

export type ConversationFlowContentItem = {
  type: ConversationFlowContentType
  text?: string
  url?: string
  caption?: string
  fileName?: string
  name?: string
  phone?: string
  seconds?: number
}

export type ConversationFlowMenuAnswer = {
  id: string
  label: string
}

export type ConversationFlowConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "filled"
  | "blank"
  | "true"
  | "false"

export type ConversationFlowCondition = {
  handle: string
  field: string
  operator: ConversationFlowConditionOperator
  value?: unknown
}

export type ConversationFlowActionType =
  | "set_ai"
  | "set_operator"
  | "set_state"
  | "add_context_tag"
  | "remove_context_tag"
  | "set_context"
  | "complete_conversation"

export type ConversationFlowNodeData = {
  label?: string
  contents?: ConversationFlowContentItem[]
  question?: string
  answers?: ConversationFlowMenuAnswer[]
  invalid_text?: string
  max_errors?: number
  timeout_minutes?: number
  required?: boolean
  action?: ConversationFlowActionType
  state?: string
  tag?: string
  field?: string
  value?: unknown
  conditions?: ConversationFlowCondition[]
  flow_id?: string | null
  seconds?: number
  prompt?: string
  mode?: string | null
  changeStrength?: number
  no_response_enabled?: boolean
  no_response_wait_minutes?: number
}

export type ConversationFlowNode = {
  id: string
  type: ConversationFlowNodeType
  position: {
    x: number
    y: number
  }
  data: ConversationFlowNodeData
}

export type ConversationFlowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type ConversationFlowGraph = {
  nodes: ConversationFlowNode[]
  edges: ConversationFlowEdge[]
}

export type ConversationFlowFolder = {
  id: string
  tenantSlug: string
  name: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ConversationFlow = {
  id: string
  tenantSlug: string
  folderId?: string | null
  copiedFromFlowId?: string | null
  scope: ConversationFlowScope
  name: string
  description: string
  status: ConversationFlowStatus
  draftGraph: ConversationFlowGraph
  publishedVersionId?: string | null
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export type ConversationFlowVersion = {
  id: string
  tenantSlug: string
  flowId: string
  versionNumber: number
  graph: ConversationFlowGraph
  publishedAt: string
  createdBy?: string | null
  createdAt: string
}

export type ConversationFlowSession = {
  id: string
  tenantSlug: string
  conversationId: string
  channelInstanceId: string
  externalContactId: string
  flowId: string
  flowVersionId: string
  startedBy?: string | null
  status: ConversationFlowSessionStatus
  currentNodeId?: string | null
  awaitingNodeId?: string | null
  lastUserMessage?: string | null
  context: Record<string, unknown>
  pausedReason?: string | null
  completedReason?: string | null
  waitingSinceAt?: string | null
  expiresAt?: string | null
  pausedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type ConversationFlowEvent = {
  id: string
  tenantSlug: string
  sessionId?: string | null
  flowId?: string | null
  conversationId?: string | null
  nodeId?: string | null
  type: string
  status: ConversationFlowEventStatus
  payload?: Record<string, unknown>
  errorMessage?: string | null
  occurredAt: string
}

export type ConversationFlowLibraryItem = ConversationFlow & {
  publishedVersion?: ConversationFlowVersion | null
  activeSessionsCount: number
}

export type ConversationFlowLibraryFolder = ConversationFlowFolder & {
  flows: ConversationFlowLibraryItem[]
}

export type ConversationFlowActiveSession = ConversationFlowSession & {
  flow?: Pick<ConversationFlow, "id" | "name" | "status"> | null
  version?: Pick<ConversationFlowVersion, "id" | "versionNumber"> | null
}
