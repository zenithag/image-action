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
  maxCompositionAttempts?: number
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
  imageEndpoint?: boolean
  chatEndpoint?: boolean
  imagePricing?: Array<{ billable: string; unit: string; cost_usd: number; variant?: string }>
  imageParameters?: Record<string, { type: string; values?: string[]; min?: number; max?: number }>
}

export function isModelCompatible(model: OpenRouterModelSummary, purpose: AiModelProfilePurpose) {
  return purpose === "image_generation"
    ? model.inputModalities.includes("text") && model.inputModalities.includes("image") && model.outputModalities.includes("image")
    : (!model.imageEndpoint || model.chatEndpoint === true) && model.inputModalities.includes("text") && model.outputModalities.includes("text") && (!["vision", "composition_review"].includes(purpose) || model.inputModalities.includes("image"))
}

export type UsdBrlExchangeRate = { rate: number; date: string }

export function formatModelPrices(model: OpenRouterModelSummary, exchange?: UsdBrlExchangeRate | null, compact = false) {
  const money = (value: number, currency: "USD" | "BRL") => new Intl.NumberFormat("pt-BR", { style: "currency", currency, currencyDisplay: "symbol", minimumFractionDigits: 2, maximumFractionDigits: currency === "BRL" ? 2 : 6 }).format(value)
  function side(direction: "input" | "output") {
    const tokenPrice = direction === "input" ? model.promptPrice : model.completionPrice
    const lines = model.imageEndpoint ? (model.imagePricing || []).filter(line => line.billable.startsWith(`${direction}_`)) : tokenPrice !== undefined && tokenPrice.trim() !== "" ? [{ billable: `${direction}_text`, unit: "token", cost_usd: Number(tokenPrice) }] : []
    const groups = new Map<string, number[]>()
    for (const line of lines) {
      if (!Number.isFinite(line.cost_usd) || line.cost_usd < 0) continue
      const modality = line.billable.endsWith("_text") ? "texto" : line.billable.endsWith("_image") ? "imagem" : line.billable.endsWith("_reference") ? "referência" : line.billable
      const unit = line.unit === "token" ? "1M tokens" : line.unit === "image" ? "imagem" : line.unit === "megapixel" ? "MP" : line.unit
      const label = `${unit}${model.imageEndpoint ? ` (${modality}${line.variant ? `, ${line.variant}` : ""})` : ""}`
      groups.set(label, [...(groups.get(label) || []), line.cost_usd * (line.unit === "token" ? 1_000_000 : 1)])
    }
    return [...groups].map(([label, values]) => {
      const low = Math.min(...values), high = Math.max(...values)
      const range = (currency: "USD" | "BRL", rate: number) => `${money(low * rate, currency)}${high !== low ? `–${money(high * rate, currency)}` : ""}`
      const unit = compact && label.startsWith("1M tokens") ? groups.size === 1 && !label.includes(",") ? "" : ` ${label.replace("1M tokens", "").trim()}` : ` por ${label}`
      return `${range("USD", 1)} / ${exchange && Number.isFinite(exchange.rate) && exchange.rate > 0 ? range("BRL", exchange.rate) : "R$ indisponível"}${unit}`
    }).join("; ") || "Não informado"
  }
  return { input: side("input"), output: side("output") }
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
