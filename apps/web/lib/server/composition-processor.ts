import { findTenant } from "@/lib/server/tenants-store"
import type { CompositionJob } from "@/lib/composition-types"
import {
  ensureCompositionJobShareToken,
  findCompositionJob,
  getNextQueuedCompositionJob,
  updateCompositionJob,
} from "@/lib/server/composition-jobs-store"
import { recordAiTrace } from "@/lib/server/ai-observability-store"
import { readProviders } from "@/lib/server/channel-providers-store"
import {
  appendAssistantInboxMediaMessage,
  appendAssistantInboxMessage,
  findInboxConversation,
  listInboxMessages,
  updateInboxConversation,
  updateInboxConversationCompositionSession,
  updateInboxMessage,
} from "@/lib/server/inbox-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { findTenantInstance } from "@/lib/server/tenant-channel-instances-store"
import { recordCompositionTokenDebit } from "@/lib/server/token-ledger-store"
import { processCompositionWithOpenRouter } from "@/lib/server/openrouter-image-worker"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { sendUazapiImage } from "@/lib/server/uazapi-client"

export type CompositionProcessResult = {
  ok: boolean
  job: CompositionJob | null
  message: string
}

type CompositionDeliveryResult = {
  sent: boolean
  providerMessageId?: string
  reason?: string
}

const tenantProcessingLoops = new Map<string, Promise<void>>()

function getCompositionJobTimeoutMs() {
  const rawValue = Number(process.env.COMPOSITION_JOB_TIMEOUT_MS || "240000")

  if (!Number.isFinite(rawValue)) {
    return 240000
  }

  return Math.max(30000, rawValue)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null

  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout ao processar composicao apos ${Math.round(timeoutMs / 1000)}s.`))
    }, timeoutMs)

    promise.then(
      (value) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        resolve(value)
      },
      (error: unknown) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        reject(error)
      }
    )
  })
}

function getProviderMessageId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || !payload) {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const id = record.id ?? record.messageid ?? record.messageId

  if (typeof id === "string") {
    return id
  }

  const nestedPayloads = [record.message, record.data, record.result, record.response]

  for (const nestedPayload of nestedPayloads) {
    const nestedId: string | undefined = getProviderMessageId(nestedPayload)

    if (nestedId) {
      return nestedId
    }
  }

  return undefined
}

async function maybeAutoSendCompositionToWhatsapp(
  job: CompositionJob,
  resultImageUrl: string,
  caption: string
): Promise<CompositionDeliveryResult> {
  const settings = await getTenantSettings(job.tenantSlug)

  if (!settings.channels.whatsappEnabled) {
    return { sent: false, reason: "whatsapp_disabled" }
  }

  if (job.source === "operator" && !settings.channels.autoSendCompositionsToWhatsapp) {
    return { sent: false, reason: "auto_send_disabled" }
  }

  const instance = await findTenantInstance(job.tenantSlug, job.channelInstanceId)
  if (!instance?.connected || !instance.instanceToken) {
    return { sent: false, reason: "whatsapp_instance_not_connected" }
  }

  const provider = (await readProviders()).find((item) =>
    item.id === instance.providerId &&
    item.kind === "whatsapp" &&
    item.provider === "uazapi" &&
    item.status === "active"
  )

  if (!provider) {
    return { sent: false, reason: "uazapi_provider_not_found" }
  }

  const conversation = await findInboxConversation(job.tenantSlug, job.conversationId)
  const phone = job.contactPhone || conversation?.contact.phone || conversation?.externalContactId

  if (!phone) {
    return { sent: false, reason: "recipient_not_found" }
  }

  const payload = await sendUazapiImage(
    provider,
    instance.instanceToken,
    phone,
    resultImageUrl,
    caption,
    instance.externalName ?? instance.name,
  )

  return {
    sent: true,
    providerMessageId: getProviderMessageId(payload),
  }
}

function getCompositionCompletionCaption(job: CompositionJob, comparisonUrl: string | null) {
  return [
    job.catalogItemName ? `Sua composição de ${job.catalogItemName} ficou pronta.` : "Sua composição ficou pronta.",
    comparisonUrl ? `Comparativo: ${comparisonUrl}` : "",
    `ID do processo: ${job.id.slice(0, 8)}.`,
  ].filter(Boolean).join("\n")
}

async function findCompositionResultInboxMessage(job: CompositionJob) {
  const messages = await listInboxMessages(job.tenantSlug, job.conversationId)
  const jobShortId = job.id.slice(0, 8)

  return messages.find((message) =>
    message.direction === "outbound" &&
    message.role === "assistant" &&
    (
      (message.content.includes(`ID do job: ${jobShortId}`) && message.content.includes("Sua composição")) ||
      (message.content.includes(`ID do processo: ${jobShortId}`) && message.content.includes("Sua composição")) ||
      message.mediaFileName === `composicao-${jobShortId}.png`
    )
  )
}

async function notifyCompositionCompleted(job: CompositionJob, resultImageUrl: string) {
  const sharedJob = await ensureCompositionJobShareToken(job.tenantSlug, job.id)
  const comparisonUrl = sharedJob?.shareToken ? `${getPublicAppBaseUrl()}/compare/${sharedJob.shareToken}` : null
  const caption = getCompositionCompletionCaption(job, comparisonUrl)
  const now = new Date().toISOString()
  const existingResultMessage = await findCompositionResultInboxMessage(job)

  await updateInboxConversationCompositionSession(job.tenantSlug, job.conversationId, (session) => ({
    ...session,
    step: "completed",
    workingImage: {
      kind: "result",
      jobId: job.id,
      imageUrl: resultImageUrl,
      label: job.catalogItemName ? `resultado de ${job.catalogItemName}` : "ultima composicao gerada",
      createdAt: now,
    },
    pendingPrompt: undefined,
    pendingBaseChoice: false,
    changes: session.changes.map((change) =>
      change.jobId === job.id
        ? { ...change, status: "done", completedAt: now }
        : change
    ),
  }))

  let deliveryResult: CompositionDeliveryResult = existingResultMessage?.providerMessageId
    ? { sent: true, providerMessageId: existingResultMessage.providerMessageId }
    : { sent: false, reason: "not_attempted" }

  if (!deliveryResult.providerMessageId) {
    try {
      deliveryResult = await maybeAutoSendCompositionToWhatsapp(job, resultImageUrl, caption)
    } catch (error) {
      deliveryResult = {
        sent: false,
        reason: error instanceof Error ? error.message : "Falha ao enviar composicao para o WhatsApp.",
      }

      await recordAiTrace({
        tenantSlug: job.tenantSlug,
        conversationId: job.conversationId,
        jobId: job.id,
        stage: "composition",
        status: "error",
        event: "composition_delivery_failed",
        errorMessage: deliveryResult.reason,
      })
    }
  }

  if (!deliveryResult.sent && deliveryResult.reason && deliveryResult.reason !== "not_attempted") {
    await recordAiTrace({
      tenantSlug: job.tenantSlug,
      conversationId: job.conversationId,
      jobId: job.id,
      stage: "composition",
      status: "warning",
      event: "composition_delivery_not_sent",
      details: {
        reason: deliveryResult.reason,
      },
    })
  }

  if (!existingResultMessage) {
    await appendAssistantInboxMediaMessage({
      tenantSlug: job.tenantSlug,
      conversationId: job.conversationId,
      content: caption,
      contentType: "image",
      mediaUrl: resultImageUrl,
      mediaMimeType: "image/png",
      mediaFileName: `composicao-${job.id.slice(0, 8)}.png`,
      providerMessageId: deliveryResult.providerMessageId,
      status: deliveryResult.sent ? "sent" : "failed",
      state: "completed",
      handledBy: "ai",
    })
  } else {
    if (deliveryResult.sent && (
      existingResultMessage.status !== "sent" ||
      deliveryResult.providerMessageId !== existingResultMessage.providerMessageId
    )) {
      await updateInboxMessage(job.tenantSlug, job.conversationId, existingResultMessage.id, {
        providerMessageId: deliveryResult.providerMessageId,
        status: "sent",
        content: caption,
        mediaUrl: resultImageUrl,
        imageUrl: resultImageUrl,
      })
    } else if (!deliveryResult.sent && existingResultMessage.status !== "failed") {
      await updateInboxMessage(job.tenantSlug, job.conversationId, existingResultMessage.id, {
        status: "failed",
        content: caption,
        mediaUrl: resultImageUrl,
        imageUrl: resultImageUrl,
      })
    }

    await updateInboxConversation(job.tenantSlug, job.conversationId, {
      state: "completed",
      status: deliveryResult.sent ? "waiting_customer" : "waiting_operator",
      lastMessage: caption,
      lastMessageAt: new Date().toISOString(),
    })
  }
}

async function notifyCompositionFailed(job: CompositionJob, errorMessage: string) {
  const now = new Date().toISOString()
  const content = [
    `Não consegui finalizar a composição ${job.id.slice(0, 8)}.`,
    "Você pode tentar novamente ou chamar um operador para revisar o pedido.",
    `Erro: ${errorMessage}`,
  ].join("\n")

  await updateInboxConversationCompositionSession(job.tenantSlug, job.conversationId, (session) => ({
    ...session,
    step: session.workingImage ? "completed" : "idle",
    pendingPrompt: undefined,
    pendingBaseChoice: false,
    changes: session.changes.map((change) =>
      change.jobId === job.id
        ? { ...change, status: "failed", completedAt: now }
        : change
    ),
  }))

  await appendAssistantInboxMessage({
    tenantSlug: job.tenantSlug,
    conversationId: job.conversationId,
    content,
    state: "idle",
    handledBy: "operator",
  })
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

  if ((await findTenant(tenantSlug))?.status !== "active") return { ok: false, job, message: "Cliente inativo; processamento pausado." }

  if (job.status === "processing") {
    return {
      ok: false,
      job,
      message: "Job ja esta em processamento.",
    }
  }

  if (job.status === "done") {
    if (job.resultImageUrl) {
      await notifyCompositionCompleted(job, job.resultImageUrl)
    }

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

  const activeProcessingJob: CompositionJob = processingJob

  await recordAiTrace({
    tenantSlug,
    conversationId: activeProcessingJob.conversationId,
    jobId: activeProcessingJob.id,
    stage: "composition",
    status: "success",
    event: "composition_processing_started",
    details: {
      mode: activeProcessingJob.mode,
      source: activeProcessingJob.source,
      catalogItemId: activeProcessingJob.catalogItemId,
      catalogItemName: activeProcessingJob.catalogItemName,
      processingAttempts: activeProcessingJob.processingAttempts,
    },
  })

  try {
    const result = await withTimeout(
      processCompositionWithOpenRouter(activeProcessingJob),
      getCompositionJobTimeoutMs(),
    )
    const completedJob = await updateCompositionJob(tenantSlug, job.id, {
      status: "done",
      baseImageUrl: result.baseImageUrl,
      resultImageUrl: result.resultImageUrl,
      processorProvider: result.provider,
      processorModel: result.model,
      errorMessage: undefined,
      completedAt: new Date().toISOString(),
    })

    await recordAiTrace({
      tenantSlug,
      conversationId: activeProcessingJob.conversationId,
      jobId: activeProcessingJob.id,
      stage: "composition",
      status: "success",
      event: "composition_processing_completed",
      details: {
        provider: result.provider,
        model: result.model,
        resultImageUrl: result.resultImageUrl,
      },
    })

    try {
      const tokenDebit = await recordCompositionTokenDebit({
        tenantSlug,
        jobId: activeProcessingJob.id,
        amount: 1,
        description: activeProcessingJob.catalogItemName
          ? `Débito pela composição de ${activeProcessingJob.catalogItemName}.`
          : `Débito pela composição ${activeProcessingJob.id.slice(0, 8)}.`,
      })

      await recordAiTrace({
        tenantSlug,
        conversationId: activeProcessingJob.conversationId,
        jobId: activeProcessingJob.id,
        stage: "composition",
        status: "success",
        event: tokenDebit.created ? "composition_token_debited" : "composition_token_debit_skipped",
        details: {
          balance: tokenDebit.account.balance,
          consumedTokens: tokenDebit.account.consumedTokens,
          overageTokens: tokenDebit.account.overageTokens,
        },
      })
    } catch (tokenError) {
      await recordAiTrace({
        tenantSlug,
        conversationId: activeProcessingJob.conversationId,
        jobId: activeProcessingJob.id,
        stage: "composition",
        status: "error",
        event: "composition_token_debit_failed",
        errorMessage: tokenError instanceof Error ? tokenError.message : "Falha ao registrar consumo de tokens.",
      })
    }

    if (completedJob?.resultImageUrl) {
      try {
        await notifyCompositionCompleted(completedJob, completedJob.resultImageUrl)
      } catch (deliveryError) {
        await recordAiTrace({
          tenantSlug,
          conversationId: activeProcessingJob.conversationId,
          jobId: activeProcessingJob.id,
          stage: "composition",
          status: "error",
          event: "composition_delivery_failed",
          errorMessage: deliveryError instanceof Error ? deliveryError.message : "Falha ao enviar composicao para o WhatsApp.",
        })
      }
    }

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

    try {
      await notifyCompositionFailed(activeProcessingJob, errorMessage)
    } catch (notificationError) {
      await recordAiTrace({
        tenantSlug,
        conversationId: activeProcessingJob.conversationId,
        jobId: activeProcessingJob.id,
        stage: "composition",
        status: "error",
        event: "composition_failure_notification_failed",
        errorMessage: notificationError instanceof Error ? notificationError.message : "Falha ao notificar falha da composicao.",
      })
    }

    await recordAiTrace({
      tenantSlug,
      conversationId: activeProcessingJob.conversationId,
      jobId: activeProcessingJob.id,
      stage: "composition",
      status: "error",
      event: "composition_processing_failed",
      errorMessage,
      details: {
        mode: activeProcessingJob.mode,
        source: activeProcessingJob.source,
        catalogItemId: activeProcessingJob.catalogItemId,
        catalogItemName: activeProcessingJob.catalogItemName,
        processingAttempts: activeProcessingJob.processingAttempts,
      },
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

export function scheduleTenantCompositionProcessing(tenantSlug: string) {
  if (tenantProcessingLoops.has(tenantSlug)) {
    return false
  }

  const run = (async () => {
    try {
      while (true) {
        const nextJob = await getNextQueuedCompositionJob(tenantSlug)

        if (!nextJob) {
          break
        }

        await processCompositionJob(tenantSlug, nextJob.id)
      }
    } finally {
      tenantProcessingLoops.delete(tenantSlug)

      const pendingJob = await getNextQueuedCompositionJob(tenantSlug)

      if (pendingJob) {
        scheduleTenantCompositionProcessing(tenantSlug)
      }
    }
  })()

  tenantProcessingLoops.set(tenantSlug, run)

  return true
}
