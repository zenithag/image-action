import { NextResponse } from "next/server"

import { scheduleTenantCompositionProcessing } from "@/lib/server/composition-processor"
import { retryCompositionJob } from "@/lib/server/composition-jobs-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const job = await retryCompositionJob(slug, id)

  if (!job) {
    return NextResponse.json({ error: "Job de composicao nao encontrado." }, { status: 404 })
  }

  scheduleTenantCompositionProcessing(slug)

  return NextResponse.json(job)
}
