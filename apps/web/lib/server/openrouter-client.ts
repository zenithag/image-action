import type { AiModelProfile, AiProvider, OpenRouterModelSummary } from "@/lib/ai-types"
import { isModelCompatible } from "@/lib/ai-types"

type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant"
  content: string | OpenRouterContentPart[]
}

type OpenRouterChatChoice = {
  message?: {
    content?: string | null
  }
}

type OpenRouterChatResponse = {
  id?: string
  model?: string
  choices?: OpenRouterChatChoice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

type OpenRouterModelResponse = {
  data?: Array<{
    id?: string
    name?: string
    context_length?: number
    pricing?: {
      prompt?: string
      completion?: string
    }
    architecture?: {
      input_modalities?: string[]
      output_modalities?: string[]
    }
    supported_parameters?: OpenRouterModelSummary["imageParameters"]
  }>
}

type OpenRouterCreditsResponse = {
  data?: {
    total_credits?: number
    total_usage?: number
  }
}

function appendPath(baseUrl: string, pathname: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`
}

async function readBody(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text.slice(0, 500)
  }
}

function getOpenRouterHeaders(provider: Pick<AiProvider, "baseUrl" | "apiKey">) {
  return {
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_SITE_NAME || "ComoFica",
    "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME || "ComoFica",
  }
}

function getOpenRouterError(status: number, body: unknown) {
  if (typeof body === "object" && body && "error" in body) {
    const error = (body as { error?: unknown }).error
    if (typeof error === "object" && error && "message" in error) {
      return String((error as { message?: unknown }).message || `OpenRouter respondeu HTTP ${status}.`)
    }

    return String(error || `OpenRouter respondeu HTTP ${status}.`)
  }

  if (typeof body === "object" && body && "message" in body) {
    return String((body as { message?: unknown }).message || `OpenRouter respondeu HTTP ${status}.`)
  }

  return `OpenRouter respondeu HTTP ${status}.`
}

export async function listOpenRouterModels(provider: Pick<AiProvider, "baseUrl" | "apiKey">, includePricing = false) {
  const catalogs = await Promise.all(["/models", "/images/models"].map(async pathname => {
    const response = await fetch(appendPath(provider.baseUrl, pathname), {
      method: "GET",
      headers: getOpenRouterHeaders(provider),
      signal: AbortSignal.timeout(20000),
    })
    const body = await readBody(response)

    // Older OpenRouter-compatible gateways may only expose the chat catalog.
    if (pathname === "/images/models" && response.status === 404) return []

    if (!response.ok) {
      throw new Error(getOpenRouterError(response.status, body))
    }

    const data = body as OpenRouterModelResponse

    return (data.data || [])
      .filter((model) => model.id)
      .map((model) => ({
        id: model.id || "",
        name: model.name || model.id || "",
        contextLength: model.context_length,
        promptPrice: model.pricing?.prompt,
        completionPrice: model.pricing?.completion,
        inputModalities: model.architecture?.input_modalities || [],
        outputModalities: model.architecture?.output_modalities || [],
        imageEndpoint: pathname === "/images/models",
        chatEndpoint: pathname === "/models",
        imageParameters: pathname === "/images/models" ? model.supported_parameters : undefined,
      } satisfies OpenRouterModelSummary))
  }))
  const models = new Map<string, OpenRouterModelSummary>()
  for (const catalog of catalogs) for (const model of catalog) {
    const previous = models.get(model.id)
    models.set(model.id, {
      ...previous, ...model,
      contextLength: model.contextLength ?? previous?.contextLength,
      promptPrice: model.promptPrice ?? previous?.promptPrice,
      completionPrice: model.completionPrice ?? previous?.completionPrice,
      chatEndpoint: model.chatEndpoint || previous?.chatEndpoint,
    })
  }
  if (includePricing) {
    const pending = [...models.values()].filter(model => model.imageEndpoint)
    // Catalog pricing is read only in the admin view, never on the generation path.
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (pending.length) {
        const model = pending.pop()!
        try {
          const response = await fetch(appendPath(provider.baseUrl, `/images/models/${model.id.split("/").map(encodeURIComponent).join("/")}/endpoints`), {
            headers: getOpenRouterHeaders(provider), signal: AbortSignal.timeout(5000), next: { revalidate: 3600 },
          })
          if (!response.ok) continue
          const body = await response.json() as { endpoints?: Array<{ pricing?: OpenRouterModelSummary["imagePricing"] }> }
          model.imagePricing = (body.endpoints || []).flatMap(endpoint => endpoint.pricing || []).filter(line => typeof line.billable === "string" && typeof line.unit === "string" && typeof line.cost_usd === "number" && Number.isFinite(line.cost_usd) && line.cost_usd >= 0)
        } catch { /* Missing prices stay unknown without hiding the model catalog. */ }
      }
    }))
  }
  return [...models.values()].sort((left, right) => left.id.localeCompare(right.id))
}

export async function getUsdBrlExchangeRate() {
  try {
    const response = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados/ultimos/1?formato=json", { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } })
    if (!response.ok) return null
    const rows = await response.json() as Array<{ data?: string; valor?: string }>
    const rate = Number(rows[0]?.valor)
    const date = rows[0]?.data
    return Number.isFinite(rate) && rate > 0 && date && /^\d{2}\/\d{2}\/\d{4}$/.test(date) ? { rate, date } : null
  } catch { return null }
}

export async function validateOpenRouterProfile(provider: AiProvider, profile: AiModelProfile) {
  const models = await listOpenRouterModels(provider)
  for (const id of [profile.modelId, ...(profile.purpose === "image_generation" ? [] : profile.fallbackModelIds)]) {
    const model = models.find(model => model.id === id)
    if (!model || !isModelCompatible(model, profile.purpose)) throw new Error(`O modelo ${id} não é compatível com a finalidade ${profile.purpose}.`)
  }
}

export async function getOpenRouterCredits(provider: AiProvider) {
  const response = await fetch(appendPath(provider.baseUrl, "/credits"), {
    method: "GET",
    headers: getOpenRouterHeaders(provider),
    signal: AbortSignal.timeout(20000),
  })
  const body = await readBody(response)

  if (!response.ok) {
    const error = new Error(getOpenRouterError(response.status, body))
    Object.assign(error, { status: response.status })
    throw error
  }

  const data = body as OpenRouterCreditsResponse
  const totalCredits = data.data?.total_credits
  const totalUsage = data.data?.total_usage

  if (typeof totalCredits !== "number" || typeof totalUsage !== "number") {
    throw new Error("OpenRouter nao retornou dados de credito validos.")
  }

  return {
    totalCreditsUsd: totalCredits,
    totalUsageUsd: totalUsage,
    remainingCreditsUsd: totalCredits - totalUsage,
  }
}

export async function createOpenRouterChatCompletion({
  provider,
  profile,
  messages,
  user,
  signal,
  responseFormat,
}: {
  provider: AiProvider
  profile: AiModelProfile
  messages: OpenRouterMessage[]
  user?: string
  signal?: AbortSignal
  responseFormat?: { type: "json_object" }
}) {
  const response = await fetch(appendPath(provider.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: getOpenRouterHeaders(provider),
    body: JSON.stringify({
      model: profile.modelId,
      models: profile.fallbackModelIds.length > 0 ? profile.fallbackModelIds : undefined,
      route: profile.fallbackModelIds.length > 0 ? "fallback" : undefined,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      response_format: responseFormat,
      user,
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000),
  })
  const body = await readBody(response)

  if (!response.ok) {
    throw new Error(getOpenRouterError(response.status, body))
  }

  const data = body as OpenRouterChatResponse
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error("OpenRouter retornou uma resposta vazia.")
  }

  return {
    content,
    model: data.model || profile.modelId,
    usage: data.usage,
    raw: data,
  }
}

// Metadata lookup does not generate content or incur another composition.
export async function getOpenRouterGeneration(provider: AiProvider, requestId: string) {
  const url = new URL(appendPath(provider.baseUrl, "/generation"))
  url.searchParams.set("id", requestId)
  const response = await fetch(url, { headers: getOpenRouterHeaders(provider), signal: AbortSignal.timeout(10000), cache: "no-store" })
  const payload = await readBody(response) as { data?: Record<string, unknown> } | null
  const data = payload?.data
  if (!response.ok || !data || data.id !== requestId) throw new Error("Não foi possível conferir esta chamada no OpenRouter.")
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
  return {
    costUsd: finite(data.total_cost),
    promptTokens: finite(data.tokens_prompt),
    completionTokens: finite(data.tokens_completion),
    outputMedia: finite(data.num_media_completion),
    finishReason: typeof data.finish_reason === "string" ? data.finish_reason : undefined,
    verifiedAt: new Date().toISOString(),
  }
}
