import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

import type { AiModelProfile, AiModelProfilePurpose } from "@/lib/ai-types"

const dataFile = getRuntimeDataFile("ai-model-profiles.json")

const profilePurposes = new Set<AiModelProfilePurpose>([
  "classification",
  "conversation",
  "vision",
  "image_prompt",
  "fallback",
])

function now() {
  return new Date().toISOString()
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : fallback

  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function asStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(asTrimmedString).filter(Boolean)
  }

  return asTrimmedString(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function defaultProfiles(): AiModelProfile[] {
  const timestamp = now()

  return [
    {
      id: "classification.default",
      name: "Classificacao padrao",
      purpose: "classification",
      provider: "openrouter",
      modelId: "openai/gpt-4o-mini",
      fallbackModelIds: [],
      temperature: 0.1,
      maxTokens: 600,
      enabled: true,
      notes: "Classifica intencao e proxima acao da conversa.",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "conversation.default",
      name: "Atendimento padrao",
      purpose: "conversation",
      provider: "openrouter",
      modelId: "openai/gpt-4o-mini",
      fallbackModelIds: [],
      temperature: 0.4,
      maxTokens: 1200,
      enabled: true,
      notes: "Gera respostas conversacionais para o tenant.",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "vision.default",
      name: "Visao padrao",
      purpose: "vision",
      provider: "openrouter",
      modelId: "openai/gpt-4o",
      fallbackModelIds: [],
      temperature: 0.2,
      maxTokens: 1200,
      enabled: true,
      notes: "Analisa imagens recebidas no WhatsApp.",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: "image-prompt.default",
      name: "Prompt de imagem",
      purpose: "image_prompt",
      provider: "openrouter",
      modelId: "openai/gpt-4o",
      fallbackModelIds: [],
      temperature: 0.5,
      maxTokens: 1600,
      enabled: true,
      notes: "Transforma briefing em prompt para geracao/composicao visual.",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

export async function readAiModelProfiles() {
  try {
    const contents = await readFile(dataFile, "utf8")
    const parsed = JSON.parse(contents) as unknown
    const profiles = Array.isArray(parsed) ? parsed as AiModelProfile[] : []

    return profiles.length > 0 ? profiles : defaultProfiles()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultProfiles()
    }

    throw error
  }
}

export async function writeAiModelProfiles(profiles: AiModelProfile[]) {
  await mkdir(path.dirname(dataFile), { recursive: true })
  await writeFile(dataFile, `${JSON.stringify(profiles, null, 2)}\n`, "utf8")
}

export function buildAiModelProfile(input: {
  name?: unknown
  purpose?: unknown
  modelId?: unknown
  fallbackModelIds?: unknown
  temperature?: unknown
  maxTokens?: unknown
  notes?: unknown
}): AiModelProfile {
  const name = asTrimmedString(input.name)
  const purpose = asTrimmedString(input.purpose) as AiModelProfilePurpose
  const modelId = asTrimmedString(input.modelId)
  const timestamp = now()

  if (!name) {
    throw new Error("Nome do perfil e obrigatorio.")
  }

  if (!profilePurposes.has(purpose)) {
    throw new Error("Finalidade do perfil e invalida.")
  }

  if (!modelId) {
    throw new Error("Modelo do perfil e obrigatorio.")
  }

  return {
    id: crypto.randomUUID(),
    name,
    purpose,
    provider: "openrouter",
    modelId,
    fallbackModelIds: asStringList(input.fallbackModelIds),
    temperature: asNumber(input.temperature, 0.4, 0, 2),
    maxTokens: Math.round(asNumber(input.maxTokens, 1200, 1, 128000)),
    enabled: true,
    notes: asTrimmedString(input.notes),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function updateAiModelProfile(profile: AiModelProfile, input: Partial<AiModelProfile>) {
  const purpose = asTrimmedString(input.purpose) as AiModelProfilePurpose
  const nextPurpose = profilePurposes.has(purpose) ? purpose : profile.purpose
  const modelId = asTrimmedString(input.modelId) || profile.modelId

  return {
    ...profile,
    name: asTrimmedString(input.name) || profile.name,
    purpose: nextPurpose,
    modelId,
    fallbackModelIds: input.fallbackModelIds === undefined ? profile.fallbackModelIds : asStringList(input.fallbackModelIds),
    temperature: input.temperature === undefined ? profile.temperature : asNumber(input.temperature, profile.temperature, 0, 2),
    maxTokens: input.maxTokens === undefined ? profile.maxTokens : Math.round(asNumber(input.maxTokens, profile.maxTokens, 1, 128000)),
    enabled: typeof input.enabled === "boolean" ? input.enabled : profile.enabled,
    notes: input.notes === undefined ? profile.notes : asTrimmedString(input.notes),
    updatedAt: now(),
  } satisfies AiModelProfile
}

export async function getAiModelProfile(purpose: AiModelProfilePurpose) {
  const profiles = await readAiModelProfiles()

  return profiles.find((profile) => profile.purpose === purpose && profile.enabled) ||
    profiles.find((profile) => profile.purpose === "fallback" && profile.enabled) ||
    profiles.find((profile) => profile.enabled) ||
    null
}
