import { NextResponse } from "next/server"

import { publishConversationFlow } from "@/lib/server/conversation-flows-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const result = await publishConversationFlow(slug, id)

  if (!result) {
    return NextResponse.json({ error: "Fluxo nao encontrado." }, { status: 404 })
  }

  return NextResponse.json(result)
}
