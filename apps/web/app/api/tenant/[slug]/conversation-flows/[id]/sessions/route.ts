import { NextResponse } from "next/server"

import { startConversationFlow } from "@/lib/server/conversation-flow-runner"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

type StartPayload = {
  conversationId?: unknown
}

export async function POST(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const payload = await request.json().catch(() => ({})) as StartPayload
  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId.trim() : ""

  if (!conversationId) {
    return NextResponse.json({ error: "Conversa obrigatoria." }, { status: 400 })
  }

  try {
    const session = await startConversationFlow({
      tenantSlug: slug,
      conversationId,
      flowId: id,
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel iniciar o fluxo.",
    }, { status: 400 })
  }
}
