import { NextResponse } from "next/server"

import { listInboxConversations } from "@/lib/server/inbox-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const conversations = await listInboxConversations(slug)

  return NextResponse.json(conversations)
}
