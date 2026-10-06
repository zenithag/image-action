import type { CompositionJob, GenerationUsage } from "./composition-types"

export function readGenerationUsage(payload: { id?: string; model?: string; usage?: unknown } | null, model: string): GenerationUsage {
  const usage = payload?.usage as Record<string, unknown> | undefined
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
  return { requestId: payload?.id, model: payload?.model || model, costUsd: finite(usage?.cost), promptTokens: finite(usage?.prompt_tokens), completionTokens: finite(usage?.completion_tokens), createdAt: new Date().toISOString() }
}

export function summarizeGenerationCosts(jobs: CompositionJob[]) {
  const groups = new Map<string, { type: string; jobs: number; completed: number; attempts: number; knownCostUsd: number; knownCostAttempts: number; unknownCosts: number }>()
  for (const job of jobs) {
    const ids = job.presetIds || /^PRESETS_ESTUDIO: ([a-z,-]+)\n/.exec(job.prompt)?.[1].split(",")
    const type = ids?.length ? ids.length > 1 ? `combination:${ids.join(",")}` : ids[0] : "composition"
    const group = groups.get(type) || { type, jobs: 0, completed: 0, attempts: 0, knownCostUsd: 0, knownCostAttempts: 0, unknownCosts: 0 }
    group.jobs++; if (job.status === "done") group.completed++
    const usage = job.generationUsage || []
    for (const attempt of usage) {
      group.attempts++
      if (typeof attempt.costUsd === "number" && Number.isFinite(attempt.costUsd) && attempt.costUsd >= 0) { group.knownCostUsd += attempt.costUsd; group.knownCostAttempts++ }
      else group.unknownCosts++
    }
    if (!usage.length && (job.processingAttempts > 0 || job.status === "done" || job.status === "failed")) group.unknownCosts++
    groups.set(type, group)
  }
  return [...groups.values()].sort((a, b) => b.jobs - a.jobs)
}
