import { NextResponse } from "next/server"

import { processInboundMessageWithAi } from "@/lib/server/ai-inbox-automation"
import { findInboxConversation, listInboxMessages, updateInboxConversation } from "@/lib/server/inbox-store"
import { findTenantInstance } from "@/lib/server/tenant-channel-instances-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
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

  await updateInboxConversation(slug, id, {
    handledBy: "ai",
    status: "open",
  })

  const messages = await listInboxMessages(slug, id)
  const message = [...messages].reverse().find((item) => item.direction === "inbound") ?? null

  if (!message) {
    return NextResponse.json({ error: "Nenhuma mensagem recebida para reprocessar." }, { status: 400 })
  }

  const result = await processInboundMessageWithAi({
    tenantSlug: slug,
    instance,
    conversationId: id,
    message,
  })

  return NextResponse.json(result)
}
