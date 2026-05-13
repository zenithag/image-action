import { NextResponse } from "next/server"

import { cleanupTenantCompositionStorage } from "@/lib/server/composition-storage-cleanup"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const result = await cleanupTenantCompositionStorage(slug)

  if (!result.ok && result.processingJobs.length > 0) {
    return NextResponse.json({
      ...result,
      error: "Existem composicoes em processamento. Aguarde finalizar antes de limpar o armazenamento.",
    }, { status: 409 })
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 207 })
}
