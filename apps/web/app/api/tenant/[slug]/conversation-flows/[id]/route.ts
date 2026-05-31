import { NextResponse } from "next/server"

import type { ConversationFlowGraph } from "@/lib/conversation-flow-types"
import {
  deleteConversationFlow,
  findConversationFlow,
  updateConversationFlow,
} from "@/lib/server/conversation-flows-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

type UpdateFlowPayload = {
  name?: unknown
  description?: unknown
  folderId?: unknown
  graph?: unknown
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const flow = await findConversationFlow(slug, id)

  if (!flow) {
    return NextResponse.json({ error: "Fluxo nao encontrado." }, { status: 404 })
  }

  return NextResponse.json(flow)
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const payload = await request.json().catch(() => null) as UpdateFlowPayload | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  const flow = await updateConversationFlow(slug, id, {
    name: payload.name === undefined ? undefined : asText(payload.name),
    description: payload.description === undefined ? undefined : asText(payload.description),
    folderId: payload.folderId === undefined ? undefined : asText(payload.folderId) || null,
    graph: payload.graph as ConversationFlowGraph | undefined,
  })

  if (!flow) {
    return NextResponse.json({ error: "Fluxo nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ flow, savedAt: new Date().toISOString() })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const flow = await deleteConversationFlow(slug, id)

  if (!flow) {
    return NextResponse.json({ error: "Fluxo nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, flowId: id })
}
