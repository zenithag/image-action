import type { CompositionJob } from "@/lib/composition-types"
import {
  findCompositionJob,
  getNextQueuedCompositionJob,
  updateCompositionJob,
} from "@/lib/server/composition-jobs-store"
import { processCompositionWithOpenRouter } from "@/lib/server/openrouter-image-worker"

export type CompositionProcessResult = {
  ok: boolean
  job: CompositionJob | null
  message: string
}

export async function processCompositionJob(tenantSlug: string, jobId: string): Promise<CompositionProcessResult> {
  const job = await findCompositionJob(tenantSlug, jobId)

  if (!job) {
    return {
      ok: false,
      job: null,
      message: "Job de composicao nao encontrado.",
    }
  }

  if (job.status === "processing") {
    return {
      ok: false,
      job,
      message: "Job ja esta em processamento.",
    }
  }

  if (job.status === "done") {
    return {
      ok: true,
      job,
      message: "Job ja foi concluido.",
    }
  }

  const startedAt = new Date().toISOString()
  const processingJob = await updateCompositionJob(tenantSlug, job.id, {
    status: "processing",
    errorMessage: undefined,
    startedAt,
    completedAt: undefined,
    processingAttempts: (job.processingAttempts ?? 0) + 1,
  })

  if (!processingJob) {
    return {
      ok: false,
      job: null,
      message: "Job de composicao nao encontrado.",
    }
  }

  try {
    const result = await processCompositionWithOpenRouter(processingJob)
    const completedJob = await updateCompositionJob(tenantSlug, job.id, {
      status: "done",
      resultImageUrl: result.resultImageUrl,
      processorProvider: result.provider,
      processorModel: result.model,
      errorMessage: undefined,
      completedAt: new Date().toISOString(),
    })

    return {
      ok: true,
      job: completedJob,
      message: "Job processado com sucesso.",
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Nao foi possivel processar a composicao."
    const failedJob = await updateCompositionJob(tenantSlug, job.id, {
      status: "failed",
      errorMessage,
      completedAt: new Date().toISOString(),
    })

    return {
      ok: false,
      job: failedJob,
      message: errorMessage,
    }
  }
}

export async function processNextCompositionJob(tenantSlug: string): Promise<CompositionProcessResult> {
  const job = await getNextQueuedCompositionJob(tenantSlug)

  if (!job) {
    return {
      ok: true,
      job: null,
      message: "Nenhum job na fila.",
    }
  }

  return processCompositionJob(tenantSlug, job.id)
}
