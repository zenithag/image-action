import type { AiTraceEntry, AiTraceStage, AiTraceStatus } from "@/lib/ai-observability-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type AiObservabilityData = {
  entries: AiTraceEntry[]
}

type RecordAiTraceInput = {
  tenantSlug: string
  conversationId?: string
  messageId?: string
  jobId?: string
  stage: AiTraceStage
  status: AiTraceStatus
  event: string
  details?: Record<string, unknown>
  errorMessage?: string
}

const dataFile = getRuntimeDataFile("ai-observability.json")
const storeKey = "ai-observability"
const MAX_ENTRIES = 500

let mutationQueue = Promise.resolve()

async function withAiObservabilityMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

function sanitizeString(value: string) {
  return value.length > 4000 ? `${value.slice(0, 4000)}…` : value
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth >= 4) {
    return "[truncated]"
  }

  if (typeof value === "string") {
    return sanitizeString(value)
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1))
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)])
    )
  }

  return String(value)
}

async function readAiObservabilityData() {
  return readJsonStore<AiObservabilityData>({
    key: storeKey,
    filePath: dataFile,
    fallback: { entries: [] },
    normalize: (parsed) => ({
      entries: Array.isArray((parsed as Partial<AiObservabilityData>)?.entries)
        ? (parsed as AiObservabilityData).entries
        : [],
    }),
  })
}

async function writeAiObservabilityData(data: AiObservabilityData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { entries: [] } }, data)
}

export async function recordAiTrace(input: RecordAiTraceInput) {
  const entry: AiTraceEntry = {
    id: crypto.randomUUID(),
    tenantSlug: input.tenantSlug,
    conversationId: input.conversationId,
    messageId: input.messageId,
    jobId: input.jobId,
    stage: input.stage,
    status: input.status,
    event: input.event,
    details: input.details ? sanitizeValue(input.details) as Record<string, unknown> : undefined,
    errorMessage: input.errorMessage ? sanitizeString(input.errorMessage) : undefined,
    createdAt: new Date().toISOString(),
  }

  console[input.status === "error" ? "error" : "info"]("[ai-trace]", JSON.stringify({
    tenantSlug: entry.tenantSlug,
    conversationId: entry.conversationId,
    messageId: entry.messageId,
    jobId: entry.jobId,
    stage: entry.stage,
    status: entry.status,
    event: entry.event,
    errorMessage: entry.errorMessage,
  }))

  await withAiObservabilityMutation(async () => {
    const data = await readAiObservabilityData()
    const entries = [entry, ...data.entries].slice(0, MAX_ENTRIES)

    await writeAiObservabilityData({ entries })
  })

  return entry
}

export async function listAiTraces(tenantSlug: string, limit = 50) {
  const data = await readAiObservabilityData()

  return data.entries
    .filter((entry) => entry.tenantSlug === tenantSlug)
    .slice(0, Math.max(1, Math.min(limit, 200)))
}
