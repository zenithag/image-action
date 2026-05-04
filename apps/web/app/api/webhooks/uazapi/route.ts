import { NextResponse } from "next/server"

import type { InboxMessageContentType } from "@/lib/inbox-types"
import { enqueueProcessInboundMessage, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { readProviders } from "@/lib/server/channel-providers-store"
import { upsertInboundInboxMessage } from "@/lib/server/inbox-store"
import {
  type StoredTenantChannelInstance,
  readTenantInstances,
  updateTenantInstance,
} from "@/lib/server/tenant-channel-instances-store"
import {
  type UazapiInstancePayload,
  type UazapiMessage,
  listUazapiInstances,
  normalizeUazapiMessageContent,
} from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type NormalizedWebhookMessage = {
  channelInstanceId?: string
  instanceToken?: string
  instanceRef?: string
  instanceOwnerPhone?: string
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

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, "") ?? ""
}

function getFirstMessagePayload(value: unknown) {
  if (Array.isArray(value)) {
    return asRecord(value.find((item) => Object.keys(asRecord(item)).length > 0))
  }

  return asRecord(value)
}

function isHistoryPayload(payload: unknown) {
  const root = asRecord(payload)
  const rootData = asRecord(root.data)
  const eventType = firstString(root.EventType, rootData.EventType, root.eventType, rootData.eventType)
  const event = firstString(root.event, rootData.event)

  return eventType.toLowerCase() === "history" || event.toLowerCase() === "history"
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
    instanceOwnerPhone: firstString(
      data.owner,
      rootData.owner,
      root.owner,
      data.ownerJid,
      rootData.ownerJid,
      root.ownerJid,
      data.ownerPhone,
      rootData.ownerPhone,
      root.ownerPhone,
      data.connectedPhone,
      rootData.connectedPhone,
      root.connectedPhone
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

function findInstanceFromPayload(
  instances: StoredTenantChannelInstance[],
  normalized: NormalizedWebhookMessage,
) {
  const ownerPhone = normalizePhone(normalized.instanceOwnerPhone)

  return instances.find((item) =>
    (normalized.channelInstanceId && item.id === normalized.channelInstanceId) ||
    (normalized.instanceToken && item.instanceToken === normalized.instanceToken) ||
    (normalized.instanceRef && [item.externalId, item.externalName, item.name].includes(normalized.instanceRef)) ||
    (ownerPhone && normalizePhone(item.phoneNumber) === ownerPhone)
  )
}

function findLocalInstanceFromRemote(
  instances: StoredTenantChannelInstance[],
  providerId: string,
  remote: UazapiInstancePayload,
) {
  return instances.find((item) =>
    item.providerId === providerId &&
    (
      (remote.token && item.instanceToken === remote.token) ||
      (remote.id && item.externalId === remote.id) ||
      (remote.name && [item.externalName, item.name].includes(remote.name))
    )
  )
}

async function resolveInstanceByProviderOwner(
  instances: StoredTenantChannelInstance[],
  ownerPhone: string,
) {
  const providers = await readProviders()
  const normalizedOwner = normalizePhone(ownerPhone)

  if (!normalizedOwner) {
    return null
  }

  for (const provider of providers) {
    if (provider.provider !== "uazapi" || !provider.baseUrl || !provider.adminToken) {
      continue
    }

    let remoteInstances: UazapiInstancePayload[] = []

    try {
      remoteInstances = await listUazapiInstances(provider)
    } catch {
      continue
    }

    const remote = remoteInstances.find((item) => normalizePhone(item.owner) === normalizedOwner)
    if (!remote) {
      continue
    }

    const instance = findLocalInstanceFromRemote(instances, provider.id, remote)
    if (instance) {
      return { instance, remote }
    }
  }

  return null
}

async function persistInstancePhoneFromPayload(
  instance: StoredTenantChannelInstance,
  normalized: NormalizedWebhookMessage,
  remote?: UazapiInstancePayload,
) {
  const ownerPhone = normalizePhone(normalized.instanceOwnerPhone || remote?.owner)

  if (!ownerPhone) {
    return instance
  }

  if (normalizePhone(instance.phoneNumber) === ownerPhone) {
    return instance
  }

  return await updateTenantInstance(instance.tenantSlug, instance.id, (current) => ({
    ...current,
    externalId: current.externalId ?? remote?.id,
    externalName: current.externalName ?? remote?.name,
    phoneNumber: ownerPhone,
    updatedAt: new Date().toISOString(),
  })) ?? instance
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null) as unknown

  if (isHistoryPayload(payload)) {
    return NextResponse.json({ ok: true, ignored: "history" })
  }

  const normalized = normalizeWebhookPayload(payload, request.url)

  if (normalized.fromMe) {
    return NextResponse.json({ ok: true, ignored: "from_me" })
  }

  if (!normalized.externalContactId || (!normalized.text && normalized.contentType === "text")) {
    return NextResponse.json({ ok: true, ignored: "unsupported_payload" })
  }

  const instances = await readTenantInstances()
  let instance = findInstanceFromPayload(instances, normalized)
  let remoteInstance: UazapiInstancePayload | undefined

  if (!instance && normalized.instanceOwnerPhone) {
    const resolved = await resolveInstanceByProviderOwner(instances, normalized.instanceOwnerPhone)
    instance = resolved?.instance
    remoteInstance = resolved?.remote
  }

  if (!instance) {
    return NextResponse.json({ ok: false, error: "Instancia nao encontrada para o webhook." }, { status: 404 })
  }

  instance = await persistInstancePhoneFromPayload(instance, normalized, remoteInstance)

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

  if (result.message) {
    await enqueueProcessInboundMessage({
      tenantSlug: instance.tenantSlug,
      channelInstanceId: instance.id,
      conversationId: result.conversation.id,
      messageId: result.message.id,
    })
    scheduleAppJobProcessing()
  }

  return NextResponse.json({
    ok: true,
    conversationId: result.conversation.id,
    messageId: result.message?.id ?? null,
    aiQueued: true,
  })
}
