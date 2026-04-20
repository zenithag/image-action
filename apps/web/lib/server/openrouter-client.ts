import type { AiModelProfile, AiProvider, OpenRouterModelSummary } from "@/lib/ai-types"

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

function getOpenRouterHeaders(provider: AiProvider) {
  return {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_SITE_NAME || "VisualFlow",
    "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME || "VisualFlow",
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

export async function listOpenRouterModels(provider: AiProvider) {
  const response = await fetch(appendPath(provider.baseUrl, "/models"), {
    method: "GET",
    headers: getOpenRouterHeaders(provider),
    signal: AbortSignal.timeout(20000),
  })
  const body = await readBody(response)

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
    } satisfies OpenRouterModelSummary))
    .sort((left, right) => left.id.localeCompare(right.id))
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
}: {
  provider: AiProvider
  profile: AiModelProfile
  messages: OpenRouterMessage[]
  user?: string
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
      user,
    }),
    signal: AbortSignal.timeout(45000),
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
