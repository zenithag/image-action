import { NextResponse } from "next/server"

import type { InboxMessageContentType } from "@/lib/inbox-types"
import { processInboundMessageWithAi } from "@/lib/server/ai-inbox-automation"
import { upsertInboundInboxMessage } from "@/lib/server/inbox-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"
import { type UazapiMessage, normalizeUazapiMessageContent } from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type NormalizedWebhookMessage = {
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

function normalizeWebhookPayload(payload: unknown): NormalizedWebhookMessage {
  const root = asRecord(payload)
  const data = asRecord(root.data) && Object.keys(asRecord(root.data)).length > 0 ? asRecord(root.data) : root
  const message = asRecord(data.message)
  const key = asRecord(data.key ?? message.key ?? root.key)
  const remoteJid = firstString(key.remoteJid, data.remoteJid, data.from, root.from)
  const externalContactId = remoteJid || firstString(data.chatid, data.chatId, root.chatid, root.chatId)
  const content = normalizeUazapiMessageContent(data as UazapiMessage)

  return {
    instanceToken: firstString(root.token, data.token, root.instanceToken, data.instanceToken),
    instanceRef: firstString(data.instance, root.instance, data.instanceId, root.instanceId, data.instanceName, root.instanceName),
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
  const normalized = normalizeWebhookPayload(payload)

  if (normalized.fromMe) {
    return NextResponse.json({ ok: true, ignored: "from_me" })
  }

  if (!normalized.externalContactId || (!normalized.text && normalized.contentType === "text")) {
    return NextResponse.json({ ok: true, ignored: "unsupported_payload" })
  }

  const instances = await readTenantInstances()
  const instance = instances.find((item) =>
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
