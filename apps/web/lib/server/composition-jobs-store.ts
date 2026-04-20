import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CompositionJob, CompositionJobInput, CompositionJobStatus } from "@/lib/composition-types"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type CompositionJobsData = {
  jobs: CompositionJob[]
}

const dataFile = getRuntimeDataFile("composition-jobs.json")
let mutationQueue = Promise.resolve()

async function withCompositionJobsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readCompositionJobsData(): Promise<CompositionJobsData> {
  try {
    const contents = await readFile(dataFile, "utf8")
    const parsed = JSON.parse(contents) as Partial<CompositionJobsData>

    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { jobs: [] }
    }

    throw error
  }
}

async function writeCompositionJobsData(data: CompositionJobsData) {
  await mkdir(path.dirname(dataFile), { recursive: true })
  const temporaryFile = `${dataFile}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`

  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  await rename(temporaryFile, dataFile)
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
