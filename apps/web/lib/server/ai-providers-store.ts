import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

import type { AiProvider, SafeAiProvider } from "@/lib/ai-types"

const dataFile = getRuntimeDataFile("ai-providers.json")
const storeKey = "ai-providers"
const defaultOpenRouterBaseUrl = "https://openrouter.ai/api/v1"

function now() {
  return new Date().toISOString()
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

export function sanitizeAiProvider(provider: AiProvider): SafeAiProvider {
  const { apiKey, ...safeProvider } = provider

  return {
    ...safeProvider,
    apiKeyConfigured: Boolean(apiKey),
  }
}

export async function readAiProviders() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: [] as AiProvider[],
    normalize: (parsed) => Array.isArray(parsed) ? parsed as AiProvider[] : [],
  })
}

export async function writeAiProviders(providers: AiProvider[]) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: [] as AiProvider[] }, providers)
}

export function buildAiProvider(input: {
  name?: unknown
  apiKey?: unknown
  baseUrl?: unknown
  monthlyBudgetCents?: unknown
  notes?: unknown
}): AiProvider {
  const timestamp = now()
  const name = asTrimmedString(input.name)
  const apiKey = asTrimmedString(input.apiKey)
  const baseUrl = asTrimmedString(input.baseUrl) || defaultOpenRouterBaseUrl
  const monthlyBudgetCents = asOptionalNumber(input.monthlyBudgetCents)
  const notes = asTrimmedString(input.notes)

  if (!name) {
    throw new Error("Nome do provider e obrigatorio.")
  }

  if (!apiKey) {
    throw new Error("API key do OpenRouter e obrigatoria.")
  }

  return {
    id: crypto.randomUUID(),
    name,
    provider: "openrouter",
    status: "active",
    apiKey,
    baseUrl,
    monthlyBudgetCents,
    health: "warning",
    notes: notes || "Provider OpenRouter cadastrado pelo Superadmin.",
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function updateAiProvider(provider: AiProvider, input: {
  name?: unknown
  apiKey?: unknown
  baseUrl?: unknown
  monthlyBudgetCents?: unknown
  notes?: unknown
  status?: unknown
}) {
  const apiKey = asTrimmedString(input.apiKey)
  const monthlyBudgetCents = asOptionalNumber(input.monthlyBudgetCents)
  const status = input.status === "maintenance" || input.status === "disabled" ? input.status : input.status === "active" ? "active" : provider.status

  return {
    ...provider,
    name: asTrimmedString(input.name) || provider.name,
    apiKey: apiKey || provider.apiKey,
    baseUrl: asTrimmedString(input.baseUrl) || provider.baseUrl,
    monthlyBudgetCents: monthlyBudgetCents ?? provider.monthlyBudgetCents,
    notes: asTrimmedString(input.notes) || provider.notes,
    status,
    updatedAt: now(),
  } satisfies AiProvider
}

export async function getActiveOpenRouterProvider() {
  const providers = await readAiProviders()
  const candidates = providers
    .filter((provider) =>
      provider.provider === "openrouter" &&
      provider.status === "active" &&
      Boolean(provider.apiKey) &&
      provider.lastCreditStatus !== "empty"
    )
    .sort((left, right) => {
      if (left.lastCreditStatus === "available" && right.lastCreditStatus !== "available") return -1
      if (left.lastCreditStatus !== "available" && right.lastCreditStatus === "available") return 1

      return (right.lastRemainingCreditsUsd ?? 0) - (left.lastRemainingCreditsUsd ?? 0)
    })
  const storedProvider = candidates[0]

  if (storedProvider) {
    return storedProvider
  }

  return null
}
