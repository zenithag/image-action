import { NextResponse } from "next/server"

import { findCompositionJob } from "@/lib/server/composition-jobs-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const job = await findCompositionJob(slug, id)

  if (!job) {
    return NextResponse.json({ error: "Job de composicao nao encontrado." }, { status: 404 })
  }

  return NextResponse.json(job)
}
