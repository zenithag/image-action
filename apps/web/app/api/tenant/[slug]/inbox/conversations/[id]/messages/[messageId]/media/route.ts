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
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel carregar a midia.",
    }, { status: 502 })
  }
}
