import { NextResponse } from "next/server"

import { findInboxConversation } from "@/lib/server/inbox-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const conversation = await findInboxConversation(slug, id)

  if (!conversation) {
    return NextResponse.json({ error: "Conversa nao encontrada." }, { status: 404 })
  }

  return NextResponse.json(conversation)
}
