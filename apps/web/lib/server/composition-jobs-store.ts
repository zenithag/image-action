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

export async function listCompositionJobs(tenantSlug: string) {
  const data = await readCompositionJobsData()

  return sortJobs(data.jobs.filter((job) => job.tenantSlug === tenantSlug))
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
      catalogItemId: input.catalogItemId,
      catalogItemName: input.catalogItemName,
      catalogColorReference: input.catalogColorReference,
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
    "status" | "resultImageUrl" | "errorMessage" | "processingAttempts" | "processorProvider" | "processorModel" | "startedAt" | "completedAt"
  >>
) {
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

export async function retryCompositionJob(tenantSlug: string, jobId: string) {
  return updateCompositionJob(tenantSlug, jobId, {
    status: "queued",
    resultImageUrl: undefined,
    errorMessage: undefined,
    startedAt: undefined,
    completedAt: undefined,
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
