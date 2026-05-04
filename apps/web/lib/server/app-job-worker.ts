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
import { syncDueWhatsappInboxes } from "@/lib/server/whatsapp-inbox-sync"

const MAX_JOBS_PER_PASS = 25
const MIN_WHATSAPP_SYNC_CHECK_MS = Math.max(
  3_000,
  Number(process.env.APP_JOB_WHATSAPP_SYNC_CHECK_INTERVAL_SECONDS || 3) * 1000
)

let lastWhatsappSyncCheckAt = 0
let whatsappSyncCheck: Promise<void> | null = null

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

async function maybeSyncWhatsappInboxes() {
  if (process.env.APP_JOB_ENABLE_WHATSAPP_BACKGROUND_SYNC === "false") {
    return
  }

  const now = Date.now()
  if (whatsappSyncCheck || now - lastWhatsappSyncCheckAt < MIN_WHATSAPP_SYNC_CHECK_MS) {
    return
  }

  lastWhatsappSyncCheckAt = now
  whatsappSyncCheck = syncDueWhatsappInboxes()
    .then((result) => {
      if (result.createdMessages > 0 || result.aiProcessedMessages > 0 || result.errors.length > 0) {
        console.info("[app-job-worker] whatsapp inbox sync", result)
      }
    })
    .catch((error: unknown) => {
      console.error("[app-job-worker] whatsapp inbox sync failed", error)
    })
    .finally(() => {
      whatsappSyncCheck = null
    })

  await whatsappSyncCheck
}

export async function processAppJobQueue() {
  await maybeSyncWhatsappInboxes()

  let processedCount = 0

  for (let index = 0; index < MAX_JOBS_PER_PASS; index += 1) {
    const processed = await processAppJob()

    if (!processed) {
      return processedCount
    }

    processedCount += 1
  }

  return processedCount
}
