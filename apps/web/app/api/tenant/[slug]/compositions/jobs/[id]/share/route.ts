import { NextResponse } from "next/server"

import { getCompositionBaseImageUrl } from "@/lib/composition-image-url"
import { ensureCompositionJobShareToken } from "@/lib/server/composition-jobs-store"

type RouteContext = {
  params: Promise<{
    slug: string
    id: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const job = await ensureCompositionJobShareToken(slug, id)

  if (!job) {
    return NextResponse.json({ error: "Job nao encontrado." }, { status: 404 })
  }

  if (!getCompositionBaseImageUrl(job) || !job.resultImageUrl || job.status !== "done" || !job.shareToken) {
    return NextResponse.json({ error: "A composicao precisa estar concluida para gerar link publico." }, { status: 409 })
  }

  return NextResponse.json({
    shareToken: job.shareToken,
    sharePath: `/compare/${job.shareToken}`,
  })
}
