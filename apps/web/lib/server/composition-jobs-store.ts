import type { CompositionJob, CompositionJobInput, CompositionJobStatus } from "@/lib/composition-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type CompositionJobsData = {
  jobs: CompositionJob[]
}

const dataFile = getRuntimeDataFile("composition-jobs.json")
const storeKey = "composition-jobs"
let mutationQueue = Promise.resolve()

async function withCompositionJobsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readCompositionJobsData(): Promise<CompositionJobsData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { jobs: [] },
    normalize: (parsed) => ({
      jobs: Array.isArray((parsed as Partial<CompositionJobsData>)?.jobs)
        ? (parsed as CompositionJobsData).jobs
        : [],
    }),
  })
}

async function writeCompositionJobsData(data: CompositionJobsData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { jobs: [] } }, data)
}

function sortJobs(jobs: CompositionJob[]) {
  return [...jobs].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeReferences(value: CompositionJobInput["references"]) {
  if (!Array.isArray(value)) return undefined

  const references = value
    .map((reference) => ({
      source: reference.source,
      messageId: normalizeText(reference.messageId) || undefined,
      imageUrl: normalizeText(reference.imageUrl) || undefined,
      catalogItemId: normalizeText(reference.catalogItemId) || undefined,
      catalogItemName: normalizeText(reference.catalogItemName) || undefined,
      catalogSku: normalizeText(reference.catalogSku) || undefined,
      catalogCategory: normalizeText(reference.catalogCategory) || undefined,
      catalogDescription: normalizeText(reference.catalogDescription) || undefined,
    }))
    .filter((reference) =>
      reference.source === "inbox"
        ? Boolean(reference.messageId || reference.imageUrl)
        : Boolean(reference.catalogItemId || reference.catalogItemName || reference.imageUrl)
    )

  return references.length > 0 ? references : undefined
}

export async function listCompositionJobs(tenantSlug: string, options?: { includeArchived?: boolean }) {
  const data = await readCompositionJobsData()

  return sortJobs(data.jobs.filter((job) =>
    job.tenantSlug === tenantSlug &&
    (options?.includeArchived || !job.archivedAt)
  ))
}

export async function findCompositionJob(tenantSlug: string, jobId: string) {
  const data = await readCompositionJobsData()

  return data.jobs.find((job) => job.tenantSlug === tenantSlug && job.id === jobId) ?? null
}

export async function createCompositionJob(tenantSlug: string, input: CompositionJobInput) {
  return withCompositionJobsMutation(async () => {
    const data = await readCompositionJobsData()
    const existingJob = input.sourceMessageId
      ? data.jobs.find((job) => job.tenantSlug === tenantSlug && job.sourceMessageId === input.sourceMessageId)
      : null

    if (existingJob) {
      return { job: existingJob, created: false }
    }

    const now = new Date().toISOString()
    const prompt = normalizeText(input.prompt) || "Composicao visual solicitada pelo cliente."
    const job: CompositionJob = {
      id: crypto.randomUUID(),
      purpose: input.purpose === "studio-preset" ? "studio-preset" : "composition",
      tenantSlug,
      conversationId: input.conversationId,
      channelInstanceId: input.channelInstanceId,
      contactName: normalizeText(input.contactName) || "Contato",
      contactPhone: normalizeText(input.contactPhone) || undefined,
      mode: input.mode ?? "interior",
      status: "queued",
      source: input.source ?? "ai",
      sourceMessageId: input.sourceMessageId,
      baseMessageId: input.baseMessageId,
      baseImageUrl: input.baseImageUrl,
      referenceMessageId: input.referenceMessageId,
      referenceImageUrl: input.referenceImageUrl,
      catalogItemId: input.catalogItemId,
      catalogItemName: input.catalogItemName,
      catalogColorReference: input.catalogColorReference,
      references: normalizeReferences(input.references),
      changeStrength: typeof input.changeStrength === "number"
        ? Math.max(0, Math.min(100, Math.round(input.changeStrength)))
        : undefined,
      prompt,
      processingAttempts: 0,
      createdAt: now,
      updatedAt: now,
    }

    await writeCompositionJobsData({
      jobs: [job, ...data.jobs],
    })

    return { job, created: true }
  })
}

export async function updateCompositionJob(
  tenantSlug: string,
  jobId: string,
  updates: Partial<Pick<
    CompositionJob,
    "purpose" | "status" | "baseImageUrl" | "resultImageUrl" | "shareToken" | "shareEnabledAt" | "archivedAt" | "errorMessage" | "processingAttempts" | "processorProvider" | "processorModel" | "startedAt" | "completedAt"
  >>
): Promise<CompositionJob | null> {
  return withCompositionJobsMutation(async () => {
    const data = await readCompositionJobsData()
    let updatedJob: CompositionJob | null = null
    const now = new Date().toISOString()

    const jobs = data.jobs.map((job) => {
      if (job.tenantSlug !== tenantSlug || job.id !== jobId) {
        return job
      }

      updatedJob = {
        ...job,
        ...updates,
        processingAttempts: updates.processingAttempts ?? job.processingAttempts ?? 0,
        updatedAt: now,
      }

      return updatedJob
    })

    if (!updatedJob) {
      return null
    }

    await writeCompositionJobsData({ jobs })

    return updatedJob
  })
}

export async function ensureCompositionJobShareToken(tenantSlug: string, jobId: string): Promise<CompositionJob | null> {
  return withCompositionJobsMutation(async () => {
    const data = await readCompositionJobsData()
    let updatedJob: CompositionJob | null = null
    const now = new Date().toISOString()

    const jobs = data.jobs.map((job) => {
      if (job.tenantSlug !== tenantSlug || job.id !== jobId) {
        return job
      }

      if (job.shareToken) {
        updatedJob = job
        return job
      }

      updatedJob = {
        ...job,
        shareToken: crypto.randomUUID(),
        shareEnabledAt: now,
        updatedAt: now,
      }

      return updatedJob
    })

    if (!updatedJob) {
      return null
    }

    await writeCompositionJobsData({ jobs })

    return updatedJob
  })
}

export async function findCompositionJobByShareToken(shareToken: string) {
  const data = await readCompositionJobsData()

  return data.jobs.find((job) => job.shareToken === shareToken) ?? null
}

export async function retryCompositionJob(tenantSlug: string, jobId: string) {
  return updateCompositionJob(tenantSlug, jobId, {
    status: "queued",
    resultImageUrl: undefined,
    errorMessage: undefined,
    startedAt: undefined,
    completedAt: undefined,
  })
}

/**
 * Studio preset results are hidden from the Compositions list (purpose "studio-preset"). Saving one
 * promotes it to a regular composition. Only finished jobs that have an image can be saved.
 */
export async function saveStudioPresetJobAsComposition(tenantSlug: string, jobId: string) {
  const job = await findCompositionJob(tenantSlug, jobId)

  if (!job) return { ok: false as const, reason: "not-found" as const }
  if (job.purpose !== "studio-preset") return { ok: true as const, job, alreadySaved: true }
  if (job.status !== "done" || !job.resultImageUrl) return { ok: false as const, reason: "not-ready" as const }

  const saved = await updateCompositionJob(tenantSlug, jobId, { purpose: "composition" })

  return saved ? { ok: true as const, job: saved, alreadySaved: false } : { ok: false as const, reason: "not-found" as const }
}

export async function archiveCompositionJob(tenantSlug: string, jobId: string) {
  return updateCompositionJob(tenantSlug, jobId, {
    archivedAt: new Date().toISOString(),
  })
}

export async function purgeTenantCompositionJobs(tenantSlug: string) {
  return withCompositionJobsMutation(async () => {
    const data = await readCompositionJobsData()
    const tenantJobs = data.jobs.filter((job) => job.tenantSlug === tenantSlug)
    const processingJobs = tenantJobs.filter((job) => job.status === "processing")

    if (processingJobs.length > 0) {
      return {
        purged: false as const,
        jobs: tenantJobs,
        processingJobs,
      }
    }

    await writeCompositionJobsData({
      jobs: data.jobs.filter((job) => job.tenantSlug !== tenantSlug),
    })

    return {
      purged: true as const,
      jobs: tenantJobs,
      processingJobs: [],
    }
  })
}

export async function getNextQueuedCompositionJob(tenantSlug: string) {
  const jobs = await listCompositionJobs(tenantSlug)

  return [...jobs]
    .filter((job) => job.status === "queued")
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())[0] ?? null
}

export function getCompositionJobStats(jobs: CompositionJob[]) {
  const stats: Record<CompositionJobStatus, number> = {
    queued: 0,
    processing: 0,
    done: 0,
    failed: 0,
  }

  for (const job of jobs) {
    stats[job.status] += 1
  }

  return stats
}
