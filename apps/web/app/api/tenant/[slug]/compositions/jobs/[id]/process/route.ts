import { NextResponse } from "next/server"

import { processCompositionJob } from "@/lib/server/composition-processor"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const result = await processCompositionJob(slug, id)

  if (!result.job) {
    return NextResponse.json({ ...result, error: result.message }, { status: 404 })
  }

  if (!result.ok) {
    return NextResponse.json({ ...result, error: result.message }, { status: 422 })
  }

  return NextResponse.json(result)
}
