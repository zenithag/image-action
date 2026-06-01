import { enqueueProcessInboundMessage, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { readProviders } from "@/lib/server/channel-providers-store"
import {
  pruneInboxBeforeChannelInstanceTime,
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

export type InboxSyncPayload = {
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

export type InboxSyncRunResult = {
  status: number
  body: InboxSyncPayload
}

type BackgroundSyncResult = {
  syncedTenants: number
  scannedMessages: number
  createdMessages: number
  aiProcessedMessages: number
  errors: InboxSyncPayload["errors"]
}

const DEFAULT_BACKGROUND_SYNC_INTERVAL_MS = Math.max(
  3_000,
  Number(process.env.APP_JOB_WHATSAPP_SYNC_INTERVAL_SECONDS || 5) * 1000
)

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return ""
}

function getChatId(chat: UazapiChat) {
  return firstText(chat.wa_chatid, chat.wa_chatlid, chat.wa_fastid)
}

function getChatLookupIds(chat: UazapiChat) {
  return [...new Set([
    firstText(chat.wa_chatid),
    firstText(chat.wa_chatlid),
    firstText(chat.wa_fastid),
  ].filter(Boolean))]
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

function getMessageChatId(message: UazapiMessage) {
  const record = message as Record<string, unknown>

  return firstText(message.chatid, message.chatId, record.remoteJid, record.remoteJID)
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

function getTime(value?: string) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function getInstanceSyncStartedAt(instance: { syncStartedAt?: string; createdAt: string }) {
  return instance.syncStartedAt ?? instance.createdAt
}

export async function runInboxSync(slug: string): Promise<InboxSyncRunResult> {
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

        const messagesByKey = new Map<string, UazapiMessage>()

        for (const lookupChatId of getChatLookupIds(chat)) {
          if (lookupChatId.endsWith("@g.us")) continue

          const lookupMessages = await findUazapiMessages(provider, instance.instanceToken, lookupChatId, 20)

          for (const message of lookupMessages) {
            const key = getMessageId(message) || `${getMessageChatId(message) || lookupChatId}:${getMessageTimestampTime(message)}`
            if (!messagesByKey.has(key)) {
              messagesByKey.set(key, message)
            }
          }
        }

        const messages = [...messagesByKey.values()]
          .sort((first, second) => getMessageTimestampTime(first) - getMessageTimestampTime(second))
        scannedMessages += messages.length

        for (const message of messages) {
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
            externalContactId: getMessageChatId(message) || chatid,
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
                  allowDefaultFlow: result.createdConversation === true,
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

export async function syncDueWhatsappInboxes(intervalMs = DEFAULT_BACKGROUND_SYNC_INTERVAL_MS): Promise<BackgroundSyncResult> {
  const instances = await readTenantInstances()
  const now = Date.now()
  const dueTenantSlugs = new Set<string>()

  for (const instance of instances) {
    if (
      instance.channel !== "whatsapp" ||
      instance.status !== "connected" ||
      !instance.instanceToken
    ) {
      continue
    }

    const lastSyncedTime = getTime(instance.lastSyncedAt)
    if (!lastSyncedTime || now - lastSyncedTime >= intervalMs) {
      dueTenantSlugs.add(instance.tenantSlug)
    }
  }

  const result: BackgroundSyncResult = {
    syncedTenants: 0,
    scannedMessages: 0,
    createdMessages: 0,
    aiProcessedMessages: 0,
    errors: [],
  }

  for (const tenantSlug of dueTenantSlugs) {
    const syncResult = await runInboxSync(tenantSlug)
    result.syncedTenants += 1
    result.scannedMessages += syncResult.body.scannedMessages
    result.createdMessages += syncResult.body.createdMessages
    result.aiProcessedMessages += syncResult.body.aiProcessedMessages
    result.errors.push(...syncResult.body.errors)
  }

  return result
}
