import { NextResponse } from "next/server"

import { processNextCompositionJob } from "@/lib/server/composition-processor"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const result = await processNextCompositionJob(slug)

  return NextResponse.json(result, { status: result.ok ? 200 : 422 })
}
