import { NextResponse } from "next/server"

import type { CatalogItemStatus } from "@/lib/catalog-types"
import { bulkUpdateCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type BulkPayload = {
  ids?: unknown
  status?: unknown
  delete?: unknown
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null) as BulkPayload | null
  const ids = Array.isArray(payload?.ids) ? payload.ids.filter((id): id is string => typeof id === "string") : []

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um produto." }, { status: 400 })
  }

  const status: CatalogItemStatus | undefined = payload?.status === "inactive" ? "inactive" : payload?.status === "active" ? "active" : undefined
  const shouldDelete = payload?.delete === true

  if (!status && !shouldDelete) {
    return NextResponse.json({ error: "Acao em lote invalida." }, { status: 400 })
  }

  const items = await bulkUpdateCatalogItems(slug, ids, {
    status,
    delete: shouldDelete,
  })

  return NextResponse.json({ ok: true, items })
}
