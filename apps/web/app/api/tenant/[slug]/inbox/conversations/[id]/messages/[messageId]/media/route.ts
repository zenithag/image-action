import { NextResponse } from "next/server"

import { findInboxMessage } from "@/lib/server/inbox-store"
import { resolveWhatsAppMedia } from "@/lib/server/whatsapp-media"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string; messageId: string }>
}

function getDisposition(fileName: string, inline: boolean) {
  const safeFileName = fileName.replace(/[^\w.\- ]/g, "_")
  return `${inline ? "inline" : "attachment"}; filename="${safeFileName}"`
}

function getUnavailableImageResponse() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">',
    '<rect width="640" height="480" fill="#f1f5f9"/>',
    '<rect x="220" y="150" width="200" height="140" rx="18" fill="#e2e8f0" stroke="#cbd5e1"/>',
    '<circle cx="282" cy="202" r="20" fill="#94a3b8"/>',
    '<path d="M248 260l62-58 38 36 30-28 58 50H248z" fill="#94a3b8"/>',
    '<text x="320" y="338" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#334155">Midia indisponivel</text>',
    '<text x="320" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#64748b">Arquivo original nao encontrado</text>',
    "</svg>",
  ].join("")

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=60",
    },
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id, messageId } = await context.params
  const message = await findInboxMessage(slug, id, messageId)

  if (!message) {
    return NextResponse.json({ error: "Mensagem nao encontrada." }, { status: 404 })
  }

  try {
    const media = await resolveWhatsAppMedia(message)
    const inline = message.contentType !== "file" || media.mimeType === "application/pdf"

    const body = new Uint8Array(media.bytes)

    return new Response(body, {
      headers: {
        "content-type": media.mimeType,
        "content-length": String(media.bytes.length),
        "content-disposition": getDisposition(media.fileName, inline),
        "cache-control": "private, max-age=86400",
      },
    })
  } catch (error) {
    if (message.contentType === "image") {
      return getUnavailableImageResponse()
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel carregar a midia.",
    }, { status: 502 })
  }
}
