import { NextResponse } from "next/server"

import { readProviders } from "@/lib/server/channel-providers-store"
import { appendOperatorInboxMessage, findInboxConversation, listInboxMessages } from "@/lib/server/inbox-store"
import { findTenantInstance } from "@/lib/server/tenant-channel-instances-store"
import { sendUazapiText } from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

type SendMessagePayload = {
  text?: unknown
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getProviderMessageId(payload: unknown) {
  if (typeof payload !== "object" || !payload) {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const id = record.id ?? record.messageid ?? record.messageId

  return typeof id === "string" ? id : undefined
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const messages = await listInboxMessages(slug, id)

  return NextResponse.json(messages)
}

export async function POST(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const payload = await request.json() as SendMessagePayload
  const text = asTrimmedString(payload.text)

  if (!text) {
    return NextResponse.json({ error: "Mensagem obrigatoria." }, { status: 400 })
  }

  const conversation = await findInboxConversation(slug, id)

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  const instance = await findTenantInstance(slug, conversation.channelInstanceId)

  if (!instance) {
    return NextResponse.json({ error: "Instancia WhatsApp da conversa nao encontrada." }, { status: 404 })
  }

  const providers = await readProviders()
  const provider = providers.find((item) => item.id === instance.providerId)

  if (!provider) {
    return NextResponse.json({ error: "Provider da instancia nao encontrado." }, { status: 404 })
  }

  try {
    const sentPayload = await sendUazapiText(provider, instance.instanceToken, conversation.externalContactId, text)
    const result = await appendOperatorInboxMessage({
      tenantSlug: slug,
      conversationId: id,
      content: text,
      providerMessageId: getProviderMessageId(sentPayload),
    })

    if (!result) {
      return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
    }

    return NextResponse.json(result.message, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel enviar a mensagem.",
    }, { status: 502 })
  }
}
