import { NextResponse } from "next/server"

import type { CompositionJobInput } from "@/lib/composition-types"
import { createCompositionJob, getCompositionJobStats, listCompositionJobs } from "@/lib/server/composition-jobs-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const jobs = await listCompositionJobs(slug)

  return NextResponse.json({
    jobs,
    stats: getCompositionJobStats(jobs),
  })
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json() as CompositionJobInput

  try {
    const result = await createCompositionJob(slug, payload)

    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o job de composicao.",
    }, { status: 400 })
  }
}
