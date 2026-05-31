import { NextResponse } from "next/server"

import { importConversationFlow } from "@/lib/server/conversation-flows-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function importedFlowPayload(payload: unknown) {
  if (!isRecord(payload)) return null

  const flow = isRecord(payload.flow) ? payload.flow : payload
  const graph = flow.graph ?? flow.draftGraph

  if (!graph) return null

  return {
    name: asText(flow.name) || asText(payload.name) || "Fluxo importado",
    description: asText(flow.description) || asText(payload.description),
    folderId: asText(flow.folderId) || null,
    graph,
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null)
  const flowPayload = importedFlowPayload(payload)

  if (!flowPayload) {
    return NextResponse.json({ error: "Arquivo de fluxo invalido." }, { status: 400 })
  }

  const flow = await importConversationFlow(slug, flowPayload)

  return NextResponse.json({ flow, importedAt: new Date().toISOString() }, { status: 201 })
}
