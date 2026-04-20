export type CompositionMode = "interior" | "product" | "print" | "fashion"
export type CompositionJobStatus = "queued" | "processing" | "done" | "failed"
export type CompositionJobSource = "ai" | "operator"

export type CompositionJob = {
  id: string
  tenantSlug: string
  conversationId: string
  channelInstanceId: string
  contactName: string
  contactPhone?: string
  mode: CompositionMode
  status: CompositionJobStatus
  source: CompositionJobSource
  sourceMessageId?: string
  baseMessageId?: string
  baseImageUrl?: string
  catalogItemId?: string
  catalogItemName?: string
  catalogColorReference?: string
  prompt: string
  resultImageUrl?: string
  errorMessage?: string
  processingAttempts: number
  processorProvider?: "openrouter"
  processorModel?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}

export type CompositionJobInput = {
  conversationId: string
  channelInstanceId: string
  contactName: string
  contactPhone?: string
  mode?: CompositionMode | null
  source?: CompositionJobSource
  sourceMessageId?: string
  baseMessageId?: string
  baseImageUrl?: string
  catalogItemId?: string
  catalogItemName?: string
  catalogColorReference?: string
  prompt?: string
}
