import type { AiGuardrailRecord } from "@/lib/ai-guardrail-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

const dataFile = getRuntimeDataFile("ai-guardrails.json")
const storeKey = "ai-guardrails"

function now() {
  return new Date().toISOString()
}

function defaultGuardrails(): AiGuardrailRecord[] {
  return [
    {
      id: "adult-content-block",
      label: "Bloquear conteúdo adulto",
      description: "Impede geração de imagens com nudez ou conteúdo sexual explícito.",
      enabled: true,
    },
    {
      id: "offensive-language-filter",
      label: "Filtrar linguagem ofensiva",
      description: "Remove palavrões e linguagem agressiva das respostas do assistente.",
      enabled: true,
    },
    {
      id: "personal-data-limit",
      label: "Limitar dados pessoais",
      description: "Impede que a IA retorne CPF, RG ou dados bancários em mensagens.",
      enabled: true,
    },
    {
      id: "composition-watermark",
      label: "Watermark em composições",
      description: "Aplica marca d'água automática em todas as composições geradas.",
      enabled: false,
    },
    {
      id: "audit-log",
      label: "Log de auditoria completo",
      description: "Registra chamadas de modelo com input e output para compliance.",
      enabled: false,
    },
    {
      id: "tenant-rate-limit",
      label: "Rate limit por tenant",
      description: "Limita chamadas de IA por tenant para evitar abuso e custos inesperados.",
      enabled: true,
    },
  ]
}

function normalizeGuardrail(value: unknown): AiGuardrailRecord | null {
  const record = value as Partial<AiGuardrailRecord> | null

  if (!record || typeof record !== "object") {
    return null
  }

  const id = typeof record.id === "string" ? record.id.trim() : ""
  const label = typeof record.label === "string" ? record.label.trim() : ""
  const description = typeof record.description === "string" ? record.description.trim() : ""

  if (!id || !label || !description) {
    return null
  }

  return {
    id,
    label,
    description,
    enabled: record.enabled === true,
  }
}

export async function readAiGuardrails() {
  const records = await readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: [] as AiGuardrailRecord[],
    normalize: (parsed) => Array.isArray(parsed)
      ? parsed.map(normalizeGuardrail).filter((item): item is AiGuardrailRecord => Boolean(item))
      : [],
  })

  if (records.length === 0) {
    const defaults = defaultGuardrails()
    await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: [] as AiGuardrailRecord[] }, defaults)
    return defaults
  }

  const defaultsById = new Map(defaultGuardrails().map((item) => [item.id, item]))
  const merged = records.map((record) => ({
    ...defaultsById.get(record.id),
    ...record,
  }))
  const knownIds = new Set(merged.map((item) => item.id))
  const missingDefaults = defaultGuardrails().filter((item) => !knownIds.has(item.id))

  return [...merged, ...missingDefaults]
}

export async function writeAiGuardrails(records: AiGuardrailRecord[]) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: [] as AiGuardrailRecord[] }, records)
}

export async function updateAiGuardrail(id: string, enabled: boolean) {
  const records = await readAiGuardrails()
  const existing = records.find((record) => record.id === id)

  if (!existing) {
    return null
  }

  const updated = records.map((record) => record.id === id ? { ...record, enabled } : record)
  await writeAiGuardrails(updated)

  return updated.find((record) => record.id === id) ?? null
}
