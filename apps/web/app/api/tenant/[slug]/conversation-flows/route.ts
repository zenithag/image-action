import { NextResponse } from "next/server"

import { createConversationFlow, listConversationFlowLibrary, listPublishedConversationFlows } from "@/lib/server/conversation-flows-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type CreateFlowPayload = {
  name?: unknown
  description?: unknown
  folderId?: unknown
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const searchParams = new URL(request.url).searchParams

  if (searchParams.get("published") === "1") {
    const flows = await listPublishedConversationFlows(slug)
    return NextResponse.json({ flows })
  }

  return NextResponse.json(await listConversationFlowLibrary(slug))
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => ({})) as CreateFlowPayload
  const name = asText(payload.name)

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do fluxo." }, { status: 400 })
  }

  const flow = await createConversationFlow(slug, {
    name,
    description: asText(payload.description),
    folderId: asText(payload.folderId) || null,
  })

  return NextResponse.json(flow, { status: 201 })
}
