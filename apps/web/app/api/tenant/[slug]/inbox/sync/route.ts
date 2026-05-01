import { NextResponse } from "next/server"

import { enqueueProcessInboundMessage, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { readProviders } from "@/lib/server/channel-providers-store"
import {
  pruneInboxBeforeChannelInstanceTime,
  purgeInboxExceptChannelInstances,
  upsertSyncedInboxMessage,
} from "@/lib/server/inbox-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { readTenantInstances, updateTenantInstance } from "@/lib/server/tenant-channel-instances-store"
import {
  type UazapiChat,
  type UazapiMessage,
  findUazapiChats,
  findUazapiMessages,
  normalizeUazapiMessageContent,
} from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type InboxSyncPayload = {
  ok: boolean
  instances: number
  scannedChats: number
  scannedMessages: number
  skippedMessagesBeforeConnection: number
  skippedMessagesWithoutTimestamp: number
  prunedMessagesBeforeConnection: number
  createdMessages: number
  aiProcessedMessages: number
  aiSkippedMessages: number
  aiFailedMessages: number
  errors: Array<{ instanceId: string; message: string }>
  syncedAt?: string
  coalesced?: boolean
  skipped?: boolean
  reason?: string
}

type InboxSyncRunResult = {
  status: number
  body: InboxSyncPayload
}

type InboxSyncState = {
  inFlight?: Promise<InboxSyncRunResult>
  lastCompletedAt?: number
  lastResult?: InboxSyncRunResult
}

const MIN_SYNC_INTERVAL_MS = 15_000
const MIN_FAST_SYNC_INTERVAL_MS = 3_000
const syncStateByTenant = new Map<string, InboxSyncState>()

function getEmptySyncPayload(reason: string): InboxSyncPayload {
  return {
    ok: true,
    instances: 0,
    scannedChats: 0,
    scannedMessages: 0,
    skippedMessagesBeforeConnection: 0,
    skippedMessagesWithoutTimestamp: 0,
    prunedMessagesBeforeConnection: 0,
    createdMessages: 0,
    aiProcessedMessages: 0,
    aiSkippedMessages: 0,
    aiFailedMessages: 0,
    errors: [],
    syncedAt: new Date().toISOString(),
    skipped: true,
    reason,
  }
}

function cacheSyncResult(slug: string, result: InboxSyncRunResult) {
  syncStateByTenant.set(slug, {
    lastCompletedAt: Date.now(),
    lastResult: result,
  })
}

function cacheSyncError(slug: string, error: unknown) {
  const result: InboxSyncRunResult = {
    status: 500,
    body: {
      ok: false,
      instances: 0,
      scannedChats: 0,
      scannedMessages: 0,
      skippedMessagesBeforeConnection: 0,
      skippedMessagesWithoutTimestamp: 0,
      prunedMessagesBeforeConnection: 0,
      createdMessages: 0,
      aiProcessedMessages: 0,
      aiSkippedMessages: 0,
      aiFailedMessages: 0,
      syncedAt: new Date().toISOString(),
      errors: [{
        instanceId: "sync",
        message: error instanceof Error ? error.message : "Erro ao sincronizar inbox.",
      }],
    },
  }

  cacheSyncResult(slug, result)
  return result
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function getChatId(chat: UazapiChat) {
  return firstText(chat.wa_chatid, chat.wa_fastid)
}

function getPhoneFromJid(jid: string) {
  return jid.includes("@") ? jid.split("@")[0] : jid
}

function getContactName(chat: UazapiChat, chatid: string) {
  return firstText(chat.wa_name, chat.wa_contactName, chat.name, getPhoneFromJid(chatid), chatid)
}

function getMessageId(message: UazapiMessage) {
  return firstText(message.id, message.messageid, message.messageId)
}

function getProviderTimestampTime(timestamp: unknown) {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return timestamp > 9999999999 ? timestamp : timestamp * 1000
  }

  if (typeof timestamp === "string" && timestamp.trim()) {
    const numericTimestamp = Number(timestamp)

    if (Number.isFinite(numericTimestamp)) {
      return numericTimestamp > 9999999999 ? numericTimestamp : numericTimestamp * 1000
    }

    const dateTimestamp = Date.parse(timestamp)

    if (Number.isFinite(dateTimestamp)) {
      return dateTimestamp
    }
  }

  return 0
}

function getMessageTimestampTime(message: UazapiMessage) {
  const record = message as Record<string, unknown>

  return getProviderTimestampTime(
    message.messageTimestamp ??
    message.timestamp ??
    record.wa_timestamp ??
    record.wa_messageTimestamp ??
    record.createdAt ??
    record.created_at ??
    record.date,
  )
}

function getMessageCreatedAt(message: UazapiMessage) {
  const timestamp = getMessageTimestampTime(message)

  return timestamp > 0 ? new Date(timestamp).toISOString() : null
}

function getTime(value: string) {
  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function getInstanceSyncStartedAt(instance: { syncStartedAt?: string; createdAt: string }) {
  return instance.syncStartedAt ?? instance.createdAt
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const searchParams = new URL(_request.url).searchParams
  const waitForCompletion = searchParams.get("wait") === "1"
  const fastSync = searchParams.get("fast") === "1"
  const minSyncInterval = fastSync ? MIN_FAST_SYNC_INTERVAL_MS : MIN_SYNC_INTERVAL_MS
  const now = Date.now()
  const state = syncStateByTenant.get(slug)

  if (state?.inFlight) {
    if (!waitForCompletion) {
      return NextResponse.json({
        ...(state.lastResult?.body ?? getEmptySyncPayload("Sincronizacao ja esta em andamento.")),
        coalesced: true,
        skipped: true,
        reason: "Sincronizacao ja esta em andamento.",
      })
    }

    const result = await state.inFlight

    return NextResponse.json({
      ...result.body,
      coalesced: true,
      reason: "Sincronizacao em andamento reutilizada.",
    }, { status: result.status })
  }

  if (
    state?.lastCompletedAt &&
    state.lastResult &&
    now - state.lastCompletedAt < minSyncInterval
  ) {
    return NextResponse.json({
      ...state.lastResult.body,
      skipped: true,
      reason: "Sincronizacao recente reutilizada.",
    }, { status: state.lastResult.status })
  }

  const inFlight = runInboxSync(slug)
  syncStateByTenant.set(slug, {
    ...state,
    inFlight,
  })

  if (!waitForCompletion) {
    void inFlight
      .then((result) => cacheSyncResult(slug, result))
      .catch((error) => cacheSyncError(slug, error))

    return NextResponse.json(getEmptySyncPayload("Sincronizacao iniciada em segundo plano."), { status: 202 })
  }

  try {
    const result = await inFlight
    cacheSyncResult(slug, result)

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const result = cacheSyncError(slug, error)

    return NextResponse.json(result.body, { status: result.status })
  }
}

async function runInboxSync(slug: string): Promise<InboxSyncRunResult> {
  const settings = await getTenantSettings(slug)

  if (!settings.channels.whatsappEnabled) {
    return {
      status: 409,
      body: {
        ok: false,
        instances: 0,
        scannedChats: 0,
        scannedMessages: 0,
        skippedMessagesBeforeConnection: 0,
        skippedMessagesWithoutTimestamp: 0,
        prunedMessagesBeforeConnection: 0,
        createdMessages: 0,
        aiProcessedMessages: 0,
        aiSkippedMessages: 0,
        aiFailedMessages: 0,
        syncedAt: new Date().toISOString(),
        errors: [{ instanceId: "tenant-settings", message: "O canal WhatsApp deste tenant esta desabilitado." }],
      },
    }
  }

  const [instances, providers] = await Promise.all([
    readTenantInstances(),
    readProviders(),
  ])
  const activeInstances = instances.filter((instance) =>
    instance.tenantSlug === slug &&
    instance.channel === "whatsapp" &&
    instance.status === "connected" &&
    instance.instanceToken
  )
  await purgeInboxExceptChannelInstances(slug, activeInstances.map((instance) => instance.id))

  let scannedChats = 0
  let scannedMessages = 0
  let skippedMessagesBeforeConnection = 0
  let skippedMessagesWithoutTimestamp = 0
  let prunedMessagesBeforeConnection = 0
  let createdMessages = 0
  let aiProcessedMessages = 0
  let aiSkippedMessages = 0
  let aiFailedMessages = 0
  const errors: Array<{ instanceId: string; message: string }> = []

  for (const instance of activeInstances) {
    const provider = providers.find((item) => item.id === instance.providerId)

    if (!provider) {
      errors.push({ instanceId: instance.id, message: "Provider nao encontrado." })
      continue
    }

    try {
      const syncStartedAt = getInstanceSyncStartedAt(instance)
      const syncStartedTime = getTime(syncStartedAt)
      const pruneResult = await pruneInboxBeforeChannelInstanceTime(slug, instance.id, syncStartedAt)
      prunedMessagesBeforeConnection += pruneResult.removedMessages
      const chats = await findUazapiChats(provider, instance.instanceToken, 20)
      scannedChats += chats.length

      for (const chat of chats) {
        const chatid = getChatId(chat)
        if (!chatid || chatid.endsWith("@g.us")) continue
        const chatLastMessageTime = getProviderTimestampTime(chat.wa_lastMsgTimestamp)
        if (chatLastMessageTime && chatLastMessageTime < syncStartedTime) continue

        const messages = await findUazapiMessages(provider, instance.instanceToken, chatid, 20)
        scannedMessages += messages.length

        for (const message of messages.reverse()) {
          const content = normalizeUazapiMessageContent(message)
          if (!content.text && content.contentType === "text") continue
          const createdAt = getMessageCreatedAt(message)

          if (!createdAt) {
            skippedMessagesWithoutTimestamp += 1
            continue
          }

          if (getTime(createdAt) < syncStartedTime) {
            skippedMessagesBeforeConnection += 1
            continue
          }

          const result = await upsertSyncedInboxMessage({
            tenantSlug: slug,
            channelInstanceId: instance.id,
            channelInstanceName: instance.name,
            externalContactId: chatid,
            contactName: getContactName(chat, chatid),
            phone: getPhoneFromJid(chatid),
            text: content.text,
            contentType: content.contentType,
            mediaUrl: content.mediaUrl,
            mediaMimeType: content.mediaMimeType,
            mediaFileName: content.mediaFileName,
            mediaSize: content.mediaSize,
            mediaDurationSeconds: content.mediaDurationSeconds,
            providerMessageId: getMessageId(message),
            fromMe: message.fromMe === true,
            createdAt,
            rawPayload: message,
          })

          if (result.created) {
            createdMessages += 1

            if (result.conversation && result.message?.direction === "inbound") {
              try {
                await enqueueProcessInboundMessage({
                  tenantSlug: slug,
                  channelInstanceId: instance.id,
                  conversationId: result.conversation.id,
                  messageId: result.message.id,
                })
                scheduleAppJobProcessing()
                aiProcessedMessages += 1
              } catch (error) {
                aiFailedMessages += 1
                errors.push({
                  instanceId: instance.id,
                  message: error instanceof Error ? error.message : "Nao foi possivel enfileirar resposta da IA.",
                })
              }
            }
          }
        }
      }

      await updateTenantInstance(slug, instance.id, (current) => ({
        ...current,
        syncStartedAt: current.syncStartedAt ?? syncStartedAt,
        lastSyncedAt: new Date().toISOString(),
      }))
    } catch (error) {
      errors.push({
        instanceId: instance.id,
        message: error instanceof Error ? error.message : "Erro ao sincronizar instancia.",
      })
    }
  }

  return {
    status: 200,
    body: {
      ok: errors.length === 0,
      instances: activeInstances.length,
      scannedChats,
      scannedMessages,
      skippedMessagesBeforeConnection,
      skippedMessagesWithoutTimestamp,
      prunedMessagesBeforeConnection,
      createdMessages,
      aiProcessedMessages,
      aiSkippedMessages,
      aiFailedMessages,
      syncedAt: new Date().toISOString(),
      errors,
    },
  }
}
