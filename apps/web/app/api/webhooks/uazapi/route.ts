import { NextResponse } from "next/server"

import type { InboxMessageContentType } from "@/lib/inbox-types"
import { processInboundMessageWithAi } from "@/lib/server/ai-inbox-automation"
import { upsertInboundInboxMessage } from "@/lib/server/inbox-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"
import { type UazapiMessage, normalizeUazapiMessageContent } from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type NormalizedWebhookMessage = {
  channelInstanceId?: string
  instanceToken?: string
  instanceRef?: string
  externalMessageId?: string
  externalContactId?: string
  contactName?: string
  phone?: string
  text?: string
  contentType: InboxMessageContentType
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaSize?: number
  mediaDurationSeconds?: number
  fromMe: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }

  return ""
}

function getPhoneFromJid(jid: string) {
  return jid.includes("@") ? jid.split("@")[0] : jid
}

function getFirstMessagePayload(value: unknown) {
  if (Array.isArray(value)) {
    return asRecord(value.find((item) => Object.keys(asRecord(item)).length > 0))
  }

  return asRecord(value)
}

function normalizeWebhookPayload(payload: unknown, requestUrl: string): NormalizedWebhookMessage {
  const searchParams = new URL(requestUrl).searchParams
  const root = asRecord(payload)
  const rootData = asRecord(root.data)
  const messagePayload = getFirstMessagePayload(rootData.messages ?? root.messages)
  const data = Object.keys(messagePayload).length > 0
    ? messagePayload
    : Object.keys(rootData).length > 0
      ? rootData
      : root
  const message = asRecord(data.message)
  const key = asRecord(data.key ?? message.key ?? root.key)
  const remoteJid = firstString(key.remoteJid, key.senderPn, data.remoteJid, data.from, root.from)
  const externalContactId = remoteJid || firstString(data.chatid, data.chatId, root.chatid, root.chatId)
  const content = normalizeUazapiMessageContent({
    ...data,
    text: firstString(data.text, data.messageBody, data.body, data.content),
  } as UazapiMessage)

  return {
    channelInstanceId: firstString(searchParams.get("channelInstanceId"), root.channelInstanceId, data.channelInstanceId),
    instanceToken: firstString(searchParams.get("instanceToken"), root.token, rootData.token, data.token, root.instanceToken, data.instanceToken),
    instanceRef: firstString(
      data.instance,
      rootData.instance,
      root.instance,
      data.instanceId,
      rootData.instanceId,
      root.instanceId,
      data.instanceName,
      rootData.instanceName,
      root.instanceName,
      root.sessionId,
      rootData.sessionId,
      data.sessionId
    ),
    externalMessageId: firstString(key.id, data.id, root.id, data.messageid, root.messageid),
    externalContactId,
    contactName: firstString(data.pushName, root.pushName, data.senderName, root.senderName, data.notifyName, root.notifyName),
    phone: externalContactId ? getPhoneFromJid(externalContactId) : undefined,
    text: content.text,
    contentType: content.contentType,
    mediaUrl: content.mediaUrl,
    mediaMimeType: content.mediaMimeType,
    mediaFileName: content.mediaFileName,
    mediaSize: content.mediaSize,
    mediaDurationSeconds: content.mediaDurationSeconds,
    fromMe: key.fromMe === true || data.fromMe === true || root.fromMe === true,
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as unknown
  const normalized = normalizeWebhookPayload(payload, request.url)

  if (normalized.fromMe) {
    return NextResponse.json({ ok: true, ignored: "from_me" })
  }

  if (!normalized.externalContactId || (!normalized.text && normalized.contentType === "text")) {
    return NextResponse.json({ ok: true, ignored: "unsupported_payload" })
  }

  const instances = await readTenantInstances()
  const instance = instances.find((item) =>
    (normalized.channelInstanceId && item.id === normalized.channelInstanceId) ||
    (normalized.instanceToken && item.instanceToken === normalized.instanceToken) ||
    (normalized.instanceRef && [item.externalId, item.externalName, item.name].includes(normalized.instanceRef))
  )

  if (!instance) {
    return NextResponse.json({ ok: false, error: "Instancia nao encontrada para o webhook." }, { status: 404 })
  }

  const result = await upsertInboundInboxMessage({
    tenantSlug: instance.tenantSlug,
    channelInstanceId: instance.id,
    channelInstanceName: instance.name,
    externalContactId: normalized.externalContactId,
    contactName: normalized.contactName || normalized.phone || normalized.externalContactId,
    phone: normalized.phone,
    text: normalized.text,
    contentType: normalized.contentType,
    mediaUrl: normalized.mediaUrl,
    mediaMimeType: normalized.mediaMimeType,
    mediaFileName: normalized.mediaFileName,
    mediaSize: normalized.mediaSize,
    mediaDurationSeconds: normalized.mediaDurationSeconds,
    providerMessageId: normalized.externalMessageId,
    rawPayload: payload,
  })
  const ai = await processInboundMessageWithAi({
    tenantSlug: instance.tenantSlug,
    instance,
    conversationId: result.conversation.id,
    message: result.message,
  })

  return NextResponse.json({
    ok: true,
    conversationId: result.conversation.id,
    messageId: result.message?.id ?? null,
    ai,
  })
}
