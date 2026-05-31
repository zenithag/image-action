import { NextResponse } from "next/server"

import { pauseConversationFlowSession } from "@/lib/server/conversation-flow-runner"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ sessionId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params
  const session = await pauseConversationFlowSession(sessionId)

  if (!session) {
    return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 })
  }

  return NextResponse.json({ session })
}
