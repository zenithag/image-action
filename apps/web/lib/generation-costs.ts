import type { CompositionJob, GenerationUsage } from "./composition-types"

export function readGenerationUsage(payload: { id?: string; model?: string; usage?: unknown } | null, model: string): GenerationUsage {
  const usage = payload?.usage as Record<string, unknown> | undefined
  const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
  return { requestId: payload?.id, model: payload?.model || model, costUsd: finite(usage?.cost), promptTokens: finite(usage?.prompt_tokens), completionTokens: finite(usage?.completion_tokens), createdAt: new Date().toISOString() }
}

// Missing provider costs stay unknown: a partial sum is never a complete job cost.
export function summarizeGenerationJobCost(job: CompositionJob) {
  const usage = job.generationUsage || []
  let knownCostUsd = 0
  let knownCostAttempts = 0
  for (const attempt of usage) {
    if (typeof attempt.costUsd === "number" && Number.isFinite(attempt.costUsd) && attempt.costUsd >= 0) {
      knownCostUsd += attempt.costUsd
      knownCostAttempts++
    }
  }
  const unknownCosts = usage.length - knownCostAttempts + (!usage.length && (job.processingAttempts > 0 || job.status === "done" || job.status === "failed") ? 1 : 0)
  return { attempts: usage.length, knownCostAttempts, unknownCosts, knownCostUsd, completeCostUsd: usage.length > 0 && unknownCosts === 0 ? knownCostUsd : null }
}

export function summarizeGenerationCosts(jobs: CompositionJob[]) {
  const groups = new Map<string, {
    type: string; jobs: number; completed: number; failed: number; attempts: number
    knownCostUsd: number; knownCostAttempts: number; unknownCosts: number
    jobsWithCompleteCost: number; jobsWithUnknownCost: number
    completedWithCompleteCost: number; failedWithCompleteCost: number
    completedCostUsd: number; failedCostUsd: number
    averageCompletedCostUsd: number | null; averageFailedCostUsd: number | null
    averageTerminalJobCostUsd: number | null
    costPerSuccessfulResultUsd: number | null
  }>()
  for (const job of jobs) {
    const ids = job.presetIds || /^PRESETS_ESTUDIO: ([a-z,-]+)\n/.exec(job.prompt)?.[1].split(",")
    const type = ids?.length ? ids.length > 1 ? `combination:${ids.join(",")}` : ids[0] : "composition"
    const group = groups.get(type) || {
      type, jobs: 0, completed: 0, failed: 0, attempts: 0, knownCostUsd: 0, knownCostAttempts: 0, unknownCosts: 0,
      jobsWithCompleteCost: 0, jobsWithUnknownCost: 0, completedWithCompleteCost: 0, failedWithCompleteCost: 0,
      completedCostUsd: 0, failedCostUsd: 0, averageCompletedCostUsd: null, averageFailedCostUsd: null,
      averageTerminalJobCostUsd: null, costPerSuccessfulResultUsd: null,
    }
    group.jobs++
    if (job.status === "done") group.completed++
    if (job.status === "failed") group.failed++
    const cost = summarizeGenerationJobCost(job)
    group.attempts += cost.attempts
    group.knownCostUsd += cost.knownCostUsd
    group.knownCostAttempts += cost.knownCostAttempts
    group.unknownCosts += cost.unknownCosts
    if (cost.unknownCosts > 0) group.jobsWithUnknownCost++
    if (cost.completeCostUsd !== null) {
      group.jobsWithCompleteCost++
      if (job.status === "done") {
        group.completedWithCompleteCost++
        group.completedCostUsd += cost.completeCostUsd
      }
      if (job.status === "failed") {
        group.failedWithCompleteCost++
        group.failedCostUsd += cost.completeCostUsd
      }
    }
    groups.set(type, group)
  }
  return [...groups.values()].map(group => {
    const terminalCount = group.completedWithCompleteCost + group.failedWithCompleteCost
    const terminalCost = group.completedCostUsd + group.failedCostUsd
    return {
      ...group,
      averageCompletedCostUsd: group.completedWithCompleteCost > 0 ? group.completedCostUsd / group.completedWithCompleteCost : null,
      averageFailedCostUsd: group.failedWithCompleteCost > 0 ? group.failedCostUsd / group.failedWithCompleteCost : null,
      averageTerminalJobCostUsd: terminalCount > 0 ? terminalCost / terminalCount : null,
      costPerSuccessfulResultUsd: group.completedWithCompleteCost > 0 ? terminalCost / group.completedWithCompleteCost : null,
    }
  }).sort((a, b) => b.jobs - a.jobs)
}
