import { NextResponse } from "next/server"

import { processInboundMessageWithAi } from "@/lib/server/ai-inbox-automation"
import { findInboxConversation, listInboxMessages, updateInboxConversation } from "@/lib/server/inbox-store"
import { findTenantInstance } from "@/lib/server/tenant-channel-instances-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

function getTime(value: string) {
  return new Date(value).getTime()
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const conversation = await findInboxConversation(slug, id)

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  const instance = await findTenantInstance(slug, conversation.channelInstanceId)

  if (!instance) {
    return NextResponse.json({ error: "Instancia da conversa nao encontrada." }, { status: 404 })
  }

  const messages = await listInboxMessages(slug, id)
  const lastInbound = [...messages].reverse().find((message) => message.direction === "inbound") ?? null
  const lastOutbound = [...messages].reverse().find((message) => message.direction === "outbound") ?? null
  const shouldProcessPendingInbound = Boolean(
    lastInbound && (!lastOutbound || getTime(lastInbound.createdAt) > getTime(lastOutbound.createdAt))
  )

  const nextConversation = await updateInboxConversation(slug, id, {
    handledBy: "ai",
    status: shouldProcessPendingInbound ? "open" : "waiting_customer",
    unreadCount: 0,
  })

  if (!nextConversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  if (!shouldProcessPendingInbound) {
    return NextResponse.json({
      conversation: nextConversation,
      processed: false,
      reason: "no_pending_customer_message",
    })
  }

  const result = await processInboundMessageWithAi({
    tenantSlug: slug,
    instance,
    conversationId: id,
    message: lastInbound,
  })

  const updatedConversation = await findInboxConversation(slug, id)

  return NextResponse.json({
    conversation: updatedConversation ?? nextConversation,
    processed: result.ok,
    aiResult: result,
  })
}
