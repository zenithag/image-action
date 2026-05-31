import { NextResponse } from "next/server"

import { getActiveConversationFlowSession } from "@/lib/server/conversation-flows-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const conversationId = new URL(request.url).searchParams.get("conversationId")?.trim() ?? ""

  if (!conversationId) {
    return NextResponse.json({ session: null })
  }

  const session = await getActiveConversationFlowSession(slug, conversationId)

  return NextResponse.json({ session })
}
