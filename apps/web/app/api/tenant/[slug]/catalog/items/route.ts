import { NextResponse } from "next/server"

import type { CatalogItemInput } from "@/lib/catalog-types"
import { createCatalogItem, listCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const items = await listCatalogItems(slug)

  const url = new URL(request.url)
  if (url.searchParams.get("view") === "preview") {
    return NextResponse.json(items.map(item => ({
      ...item,
      imageUrl: item.imageUrl && !item.imageUrl.startsWith("data:image/svg")
        ? `${url.origin}/api/tenant/${encodeURIComponent(slug)}/catalog/items/${encodeURIComponent(item.id)}/image`
        : "",
    })))
  }

  return NextResponse.json(items)
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null) as CatalogItemInput | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  try {
    const item = await createCatalogItem(slug, payload)

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o produto.",
    }, { status: 400 })
  }
}
