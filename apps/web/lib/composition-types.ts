import type { StudioPresetId } from "./studio-draft"

export type GenerationUsage = { requestId?: string; model: string; costUsd?: number; promptTokens?: number; completionTokens?: number; createdAt: string }

export type CompositionMode = "interior" | "product" | "print" | "fashion"
export type CompositionJobStatus = "queued" | "processing" | "done" | "failed"
export type CompositionJobSource = "ai" | "operator"

export type CompositionJobReference = {
  source: "inbox" | "catalog" | "url"
  messageId?: string
  imageUrl?: string
  catalogItemId?: string
  catalogItemName?: string
  catalogSku?: string
  catalogCategory?: string
  catalogDescription?: string
}

export type CompositionJob = {
  operator?: { id: string; name: string }
  presetIds?: StudioPresetId[]
  purpose?: "composition" | "studio-preset"
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
  referenceMessageId?: string
  referenceImageUrl?: string
  catalogItemId?: string
  catalogItemName?: string
  catalogColorReference?: string
  references?: CompositionJobReference[]
  changeStrength?: number
  prompt: string
  resultImageUrl?: string
  shareToken?: string
  shareEnabledAt?: string
  archivedAt?: string
  errorMessage?: string
  generationUsage?: GenerationUsage[]
  processingAttempts: number
  processorProvider?: "openrouter"
  processorModel?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
}

export type CompositionJobInput = {
  operator?: { id: string; name: string }
  presetIds?: StudioPresetId[]
  purpose?: "composition" | "studio-preset"
  studioVersion?: "v1"
  conversationId: string
  channelInstanceId: string
  contactName: string
  contactPhone?: string
  mode?: CompositionMode | null
  source?: CompositionJobSource
  sourceMessageId?: string
  baseMessageId?: string
  baseImageUrl?: string
  referenceMessageId?: string
  referenceImageUrl?: string
  catalogItemId?: string
  catalogItemName?: string
  catalogColorReference?: string
  references?: CompositionJobReference[]
  changeStrength?: number
  prompt?: string
}
