import { NextResponse } from "next/server"

import { assignInboxConversationToChannelInstance } from "@/lib/server/inbox-store"
import { readTenantInstances, sanitizeTenantInstance } from "@/lib/server/tenant-channel-instances-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

type ClaimPayload = {
  channelInstanceId?: unknown
}

function isActiveWhatsappInstance(instance: Awaited<ReturnType<typeof readTenantInstances>>[number], tenantSlug: string) {
  return (
    instance.tenantSlug === tenantSlug &&
    instance.channel === "whatsapp" &&
    instance.status === "connected" &&
    instance.connected
  )
}

export async function POST(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const payload = await request.json().catch(() => ({})) as ClaimPayload
  const requestedInstanceId = typeof payload.channelInstanceId === "string" ? payload.channelInstanceId.trim() : ""
  const instances = await readTenantInstances()
  const activeInstances = instances.filter((instance) => isActiveWhatsappInstance(instance, slug))

  if (activeInstances.length === 0) {
    return NextResponse.json({
      code: "no_active_whatsapp_instance",
      error: "Nao ha instancia WhatsApp ativa para assumir esta conversa.",
    }, { status: 409 })
  }

  if (!requestedInstanceId && activeInstances.length > 1) {
    return NextResponse.json({
      code: "multiple_active_whatsapp_instances",
      error: "Escolha a instancia WhatsApp que deve assumir esta conversa.",
      instances: activeInstances.map(sanitizeTenantInstance),
    }, { status: 409 })
  }

  const selectedInstance = requestedInstanceId
    ? activeInstances.find((instance) => instance.id === requestedInstanceId)
    : activeInstances[0]

  if (!selectedInstance) {
    return NextResponse.json({
      code: "invalid_whatsapp_instance",
      error: "Instancia WhatsApp ativa nao encontrada para este tenant.",
    }, { status: 404 })
  }

  const result = await assignInboxConversationToChannelInstance(slug, id, selectedInstance)

  if (!result.ok && result.reason === "not_found") {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  if (!result.ok && result.reason === "duplicate") {
    return NextResponse.json({
      code: "conversation_already_exists_for_instance",
      error: "Ja existe uma conversa ativa deste cliente nesta instancia.",
      conversationId: result.conversation.id,
    }, { status: 409 })
  }

  return NextResponse.json({
    conversation: result.conversation,
    channelInstanceRemoved: false,
  })
}
