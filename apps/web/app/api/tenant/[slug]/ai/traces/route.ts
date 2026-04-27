import { NextResponse } from "next/server"

import { listAiTraces } from "@/lib/server/ai-observability-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const { searchParams } = new URL(request.url)
  const limitParam = Number(searchParams.get("limit") || "50")
  const limit = Number.isFinite(limitParam) ? limitParam : 50
  const entries = await listAiTraces(slug, limit)

  return NextResponse.json({ entries })
}
