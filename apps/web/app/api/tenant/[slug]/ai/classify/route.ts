import { NextResponse } from "next/server"

import { classifyInboundMessage } from "@/lib/server/ai-orchestrator"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type ClassificationPayload = {
  text?: unknown
  mediaTypes?: unknown
  conversationState?: unknown
  recentMessages?: unknown
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null) as ClassificationPayload | null
  const mediaTypes = Array.isArray(payload?.mediaTypes)
    ? payload.mediaTypes.filter((item): item is string => typeof item === "string")
    : []
  const recentMessages = Array.isArray(payload?.recentMessages)
    ? payload.recentMessages
      .filter((item): item is { role: "customer" | "assistant" | "operator" | "system"; content: string } =>
        typeof item === "object" &&
        item !== null &&
        "role" in item &&
        "content" in item &&
        ["customer", "assistant", "operator", "system"].includes(String((item as { role?: unknown }).role)) &&
        typeof (item as { content?: unknown }).content === "string"
      )
      .map((item) => ({ role: item.role, content: item.content }))
    : []

  const result = await classifyInboundMessage({
    tenantSlug: slug,
    text: typeof payload?.text === "string" ? payload.text : "",
    mediaTypes,
    conversationState: typeof payload?.conversationState === "string" ? payload.conversationState : "idle",
    recentMessages,
  })

  return NextResponse.json(result)
}
