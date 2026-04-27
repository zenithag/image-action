import { NextResponse } from "next/server"

import { updateAiGuardrail } from "@/lib/server/ai-guardrails-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const payload = await request.json().catch(() => null) as { enabled?: unknown } | null

  if (typeof payload?.enabled !== "boolean") {
    return NextResponse.json({ error: "Campo enabled inválido." }, { status: 400 })
  }

  const guardrail = await updateAiGuardrail(id, payload.enabled)

  if (!guardrail) {
    return NextResponse.json({ error: "Guardrail não encontrado." }, { status: 404 })
  }

  return NextResponse.json(guardrail)
}
