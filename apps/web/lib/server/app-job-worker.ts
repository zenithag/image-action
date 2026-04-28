import { processInboundMessageWithAi } from "@/lib/server/ai-inbox-automation"
import {
  claimNextAppJob,
  completeAppJob,
  enqueueProcessCompositionQueue,
  failAppJob,
  type ProcessInboundMessagePayload,
} from "@/lib/server/app-job-queue"
import { processNextCompositionJob } from "@/lib/server/composition-processor"
import { findInboxMessage } from "@/lib/server/inbox-store"
import { findTenantInstance } from "@/lib/server/tenant-channel-instances-store"

const MAX_JOBS_PER_PASS = 25

async function processCompositionQueue(tenantSlug: string) {
  for (let index = 0; index < MAX_JOBS_PER_PASS; index += 1) {
    const result = await processNextCompositionJob(tenantSlug)

    if (!result.job) {
      return
    }
  }

  await enqueueProcessCompositionQueue(tenantSlug)
}

async function processAppJob() {
  const job = await claimNextAppJob()

  if (!job) {
    return false
  }

  try {
    if (job.type === "process_inbound_message") {
      const payload = job.payload as ProcessInboundMessagePayload
      const instance = await findTenantInstance(payload.tenantSlug, payload.channelInstanceId)
      const message = await findInboxMessage(payload.tenantSlug, payload.conversationId, payload.messageId)

      if (!instance) {
        throw new Error("Instancia do canal nao encontrada para processar mensagem inbound.")
      }

      await processInboundMessageWithAi({
        tenantSlug: payload.tenantSlug,
        instance,
        conversationId: payload.conversationId,
        message,
      })
    } else if (job.type === "process_composition_queue") {
      await processCompositionQueue(job.payload.tenantSlug)
    } else {
      const unreachable: never = job.type
      throw new Error(`Tipo de job nao suportado: ${unreachable}`)
    }

    await completeAppJob(job.id)
  } catch (error) {
    await failAppJob(job, error)
    console.error("App job failed", { jobId: job.id, type: job.type, error })
  }

  return true
}

export async function processAppJobQueue() {
  for (let index = 0; index < MAX_JOBS_PER_PASS; index += 1) {
    const processed = await processAppJob()

    if (!processed) {
      return
    }
  }
}
