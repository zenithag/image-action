import { NextResponse } from "next/server"

import { getCatalogReferenceImageUrl } from "@/lib/server/catalog-reference-image"
import { listCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

function responseFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/)

  if (!match) {
    return null
  }

  const [, contentType, base64Flag, payload] = match
  const bytes = base64Flag
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload))

  return new NextResponse(bytes, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": contentType || "application/octet-stream",
    },
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const item = (await listCatalogItems(slug)).find((catalogItem) => catalogItem.id === id)

  if (!item?.imageUrl) {
    return NextResponse.json({ error: "Imagem do produto nao encontrada." }, { status: 404 })
  }

  if (/^https?:\/\//i.test(item.imageUrl)) {
    return NextResponse.redirect(item.imageUrl)
  }

  const catalogReferenceImage = getCatalogReferenceImageUrl(item)

  if (catalogReferenceImage) {
    const response = responseFromDataUrl(catalogReferenceImage)

    if (response) {
      return response
    }
  }

  if (item.imageUrl.startsWith("data:")) {
    const response = responseFromDataUrl(item.imageUrl)

    if (response) {
      return response
    }
  }

  return NextResponse.json({ error: "Formato de imagem nao suportado." }, { status: 415 })
}
