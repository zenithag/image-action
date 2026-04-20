import { NextResponse } from "next/server"

import { updateInboxConversation } from "@/lib/server/inbox-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const conversation = await updateInboxConversation(slug, id, {
    handledBy: "operator",
    status: "waiting_operator",
    state: "idle",
    unreadCount: 0,
  })

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  return NextResponse.json(conversation)
}
