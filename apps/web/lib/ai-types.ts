import type { ClassificationResponse } from "@studio/contracts"

export type AiProviderKind = "openrouter"
export type AiProviderStatus = "active" | "maintenance" | "disabled"
export type AiHealth = "ok" | "warning" | "error"
export type AiCreditStatus = "available" | "empty" | "unavailable"

export type AiProvider = {
  id: string
  name: string
  provider: AiProviderKind
  status: AiProviderStatus
  apiKey?: string
  baseUrl: string
  monthlyBudgetCents?: number
  lastCreditStatus?: AiCreditStatus
  lastTotalCreditsUsd?: number
  lastTotalUsageUsd?: number
  lastRemainingCreditsUsd?: number
  creditsCheckedAt?: string
  health: AiHealth
  notes: string
  createdAt: string
  updatedAt: string
}

export type SafeAiProvider = Omit<AiProvider, "apiKey"> & {
  apiKeyConfigured: boolean
}

export type AiModelProfilePurpose =
  | "classification"
  | "conversation"
  | "vision"
  | "image_prompt"
  | "image_generation"
  | "composition_review"
  | "fallback"

export type AiModelProfile = {
  id: string
  name: string
  purpose: AiModelProfilePurpose
  provider: AiProviderKind
  modelId: string
  fallbackModelIds: string[]
  temperature: number
  maxTokens: number
  enabled: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export type OpenRouterModelSummary = {
  id: string
  name: string
  contextLength?: number
  promptPrice?: string
  completionPrice?: string
  inputModalities: string[]
  outputModalities: string[]
}

export type AiProviderTestResult = {
  ok: boolean
  status: "success" | "warning" | "error"
  message: string
  httpStatus?: number
  latencyMs?: number
  modelCount?: number
  creditStatus?: AiCreditStatus
  totalCreditsUsd?: number
  totalUsageUsd?: number
  remainingCreditsUsd?: number
  creditMessage?: string
  checkedAt: string
}

export type AiClassificationResult = ClassificationResponse & {
  reply?: string
  model?: string
}
