import { createHash } from "node:crypto"
import { normalizeImageForUpload } from "@/lib/server/image-normalization"
import { NextResponse } from "next/server"

import { getCatalogReferenceImageUrl } from "@/lib/server/catalog-reference-image"
import { listCatalogItems } from "@/lib/server/catalog-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

const thumbnailCache = new Map<string, Buffer>()

async function responseFromDataUrl(dataUrl: string, width: number | null) {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/)

  if (!match) {
    return null
  }

  const [, contentType, base64Flag, payload] = match
  const bytes = base64Flag
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload))

  let output: Buffer = bytes
  let mimeType = contentType
  if (width && !contentType.includes("svg")) {
    const key = createHash("sha256").update(dataUrl).update(String(width)).digest("hex")
    const cached = thumbnailCache.get(key)
    output = cached ?? (await normalizeImageForUpload(bytes, contentType, { maxDimension: width, quality: 75 })).bytes
    if (!cached) {
      if (thumbnailCache.size >= 128) thumbnailCache.delete(thumbnailCache.keys().next().value!)
      thumbnailCache.set(key, output)
    }
    mimeType = "image/webp"
  }

  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "ETag": `"${createHash("sha256").update(output).digest("hex")}"`,
      "Content-Type": mimeType || "application/octet-stream",
    },
  })
}

export async function GET(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const requestedWidth = new URL(request.url).searchParams.get("width")
  const width = requestedWidth === null ? null : Number(requestedWidth)
  if (width !== null && (!Number.isInteger(width) || width < 32 || width > 512)) {
    return NextResponse.json({ error: "Tamanho de miniatura invalido." }, { status: 400 })
  }
  const item = (await listCatalogItems(slug)).find((catalogItem) => catalogItem.id === id)

  if (!item?.imageUrl) {
    return NextResponse.json({ error: "Imagem do produto nao encontrada." }, { status: 404 })
  }

  if (/^https?:\/\//i.test(item.imageUrl)) {
    return NextResponse.redirect(item.imageUrl)
  }

  const catalogReferenceImage = getCatalogReferenceImageUrl(item)

  if (catalogReferenceImage) {
    const response = await responseFromDataUrl(catalogReferenceImage, width)

    if (response) {
      return response
    }
  }

  if (item.imageUrl.startsWith("data:")) {
    const response = await responseFromDataUrl(item.imageUrl, width)

    if (response) {
      return response
    }
  }

  return NextResponse.json({ error: "Formato de imagem nao suportado." }, { status: 415 })
}
