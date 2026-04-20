import { NextResponse } from "next/server"

import { processInboundMessageWithAi } from "@/lib/server/ai-inbox-automation"
import { readProviders } from "@/lib/server/channel-providers-store"
import { purgeInboxExceptChannelInstances, upsertSyncedInboxMessage } from "@/lib/server/inbox-store"
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

function getMessageCreatedAt(message: UazapiMessage) {
  const timestamp = message.messageTimestamp ?? message.timestamp

  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000).toISOString()
  }

  return new Date().toISOString()
}

function getTime(value: string) {
  return new Date(value).getTime()
}

function getInstanceSyncStartedAt(instance: { syncStartedAt?: string; createdAt: string }) {
  return instance.syncStartedAt ?? instance.createdAt
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug } = await context.params
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
  let createdMessages = 0
  let aiProcessedMessages = 0
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
      const chats = await findUazapiChats(provider, instance.instanceToken, 20)
      scannedChats += chats.length

      for (const chat of chats) {
        const chatid = getChatId(chat)
        if (!chatid || chatid.endsWith("@g.us")) continue
        if (chat.wa_lastMsgTimestamp && chat.wa_lastMsgTimestamp < syncStartedTime) continue

        const messages = await findUazapiMessages(provider, instance.instanceToken, chatid, 20)
        scannedMessages += messages.length

        for (const message of messages.reverse()) {
          const content = normalizeUazapiMessageContent(message)
          if (!content.text && content.contentType === "text") continue
          const createdAt = getMessageCreatedAt(message)
          if (getTime(createdAt) < syncStartedTime) continue

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
              const aiResult = await processInboundMessageWithAi({
                tenantSlug: slug,
                instance,
                conversationId: result.conversation.id,
                message: result.message,
              })

              if (aiResult.ok) {
                aiProcessedMessages += 1
              } else {
                aiFailedMessages += 1
                errors.push({
                  instanceId: instance.id,
                  message: aiResult.error ?? aiResult.skipped ?? "Nao foi possivel processar resposta da IA.",
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

  return NextResponse.json({
    ok: errors.length === 0,
    instances: activeInstances.length,
    scannedChats,
    scannedMessages,
    createdMessages,
    aiProcessedMessages,
    aiFailedMessages,
    errors,
  })
}
