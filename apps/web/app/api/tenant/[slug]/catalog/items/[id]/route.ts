import { NextResponse } from "next/server"

import type { CatalogItemInput } from "@/lib/catalog-types"
import { deleteCatalogItem, updateCatalogItem } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const payload = await request.json().catch(() => null) as Partial<CatalogItemInput> | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  try {
    const item = await updateCatalogItem(slug, id, payload)

    if (!item) {
      return NextResponse.json({ error: "Produto nao encontrado." }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel atualizar o produto.",
    }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const deleted = await deleteCatalogItem(slug, id)

  if (!deleted) {
    return NextResponse.json({ error: "Produto nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
