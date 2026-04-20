import { createDecipheriv, createHash, hkdfSync, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { InboxMessage, InboxMessageContentType } from "@/lib/inbox-types"

type RawMediaPayload = {
  URL?: unknown
  url?: unknown
  mediaUrl?: unknown
  downloadUrl?: unknown
  fileUrl?: unknown
  directPath?: unknown
  mediaKey?: unknown
  mimetype?: unknown
  mimeType?: unknown
  fileName?: unknown
  filename?: unknown
  fileSHA256?: unknown
  fileLength?: unknown
  fileSize?: unknown
}

export type ResolvedWhatsAppMedia = {
  bytes: Buffer
  mimeType: string
  fileName: string
}

const mediaCacheDir = path.join(process.cwd(), ".local", "inbox-media")

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = asString(value)
    if (text) return text
  }

  return ""
}

function getRawMediaPayload(message: InboxMessage): RawMediaPayload {
  const rawPayload = asRecord(message.rawPayload)
  const content = asRecord(rawPayload.content)

  if (Object.keys(content).length > 0) {
    return content
  }

  const rootMessage = asRecord(rawPayload.message)
  const contentKey = getContentKey(message.contentType)
  const directMedia = asRecord(rootMessage[contentKey])

  if (Object.keys(directMedia).length > 0) {
    return directMedia
  }

  if (message.contentType === "file") {
    return asRecord(asRecord(asRecord(rootMessage.documentWithCaptionMessage).message).documentMessage)
  }

  return rawPayload
}

function getContentKey(contentType: InboxMessageContentType) {
  if (contentType === "image") return "imageMessage"
  if (contentType === "audio") return "audioMessage"
  if (contentType === "video") return "videoMessage"
  if (contentType === "file") return "documentMessage"

  return "message"
}

function getWhatsAppMediaType(contentType: InboxMessageContentType) {
  if (contentType === "image") return "Image"
  if (contentType === "audio") return "Audio"
  if (contentType === "video") return "Video"
  if (contentType === "file") return "Document"

  return "Document"
}

function getFallbackMimeType(contentType: InboxMessageContentType) {
  if (contentType === "image") return "image/jpeg"
  if (contentType === "audio") return "audio/ogg"
  if (contentType === "video") return "video/mp4"
  if (contentType === "file") return "application/octet-stream"

  return "application/octet-stream"
}

function getExtension(mimeType: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg"
  if (mimeType.includes("png")) return "png"
  if (mimeType.includes("webp")) return "webp"
  if (mimeType.includes("ogg")) return "ogg"
  if (mimeType.includes("mpeg")) return "mp3"
  if (mimeType.includes("mp4")) return "mp4"
  if (mimeType.includes("pdf")) return "pdf"

  return "bin"
}

function getMediaUrl(payload: RawMediaPayload, message: InboxMessage) {
  return firstString(
    payload.URL,
    payload.url,
    payload.mediaUrl,
    payload.downloadUrl,
    payload.fileUrl,
    message.mediaUrl,
    message.imageUrl
  )
}

function buildMediaKeys(mediaKey: string, contentType: InboxMessageContentType) {
  const expandedKey = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(mediaKey, "base64"),
      Buffer.alloc(0),
      `WhatsApp ${getWhatsAppMediaType(contentType)} Keys`,
      112
    )
  )

  return {
    iv: expandedKey.subarray(0, 16),
    cipherKey: expandedKey.subarray(16, 48),
  }
}

function decryptWhatsAppMedia(encrypted: Buffer, mediaKey: string, contentType: InboxMessageContentType) {
  const encryptedBody = encrypted.length > 10 ? encrypted.subarray(0, -10) : encrypted
  const { iv, cipherKey } = buildMediaKeys(mediaKey, contentType)
  const decipher = createDecipheriv("aes-256-cbc", cipherKey, iv)

  return Buffer.concat([decipher.update(encryptedBody), decipher.final()])
}

function assertSha256(bytes: Buffer, expectedSha256?: string) {
  if (!expectedSha256) return

  const actual = createHash("sha256").update(bytes).digest()
  const expected = Buffer.from(expectedSha256, "base64")

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Checksum da midia recebida nao confere.")
  }
}

function getCacheKey(message: InboxMessage) {
  return createHash("sha256")
    .update(`${message.id}:${message.providerMessageId ?? ""}:${message.contentType}`)
    .digest("hex")
}

async function readCachedMedia(cacheKey: string, mimeType: string, fileName: string) {
  try {
    const bytes = await readFile(path.join(mediaCacheDir, `${cacheKey}.bin`))
    return { bytes, mimeType, fileName }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null
    }

    throw error
  }
}

async function writeCachedMedia(cacheKey: string, bytes: Buffer) {
  await mkdir(mediaCacheDir, { recursive: true })
  await writeFile(path.join(mediaCacheDir, `${cacheKey}.bin`), bytes)
}

export async function resolveWhatsAppMedia(message: InboxMessage): Promise<ResolvedWhatsAppMedia> {
  if (!["image", "audio", "video", "file"].includes(message.contentType)) {
    throw new Error("Mensagem nao contem midia.")
  }

  const payload = getRawMediaPayload(message)
  const mediaUrl = getMediaUrl(payload, message)
  const mediaKey = firstString(payload.mediaKey)
  const mimeType = firstString(payload.mimetype, payload.mimeType, message.mediaMimeType) || getFallbackMimeType(message.contentType)
  const fileName = firstString(payload.fileName, payload.filename, message.mediaFileName) ||
    `${message.id}.${getExtension(mimeType)}`
  const cacheKey = getCacheKey(message)
  const cached = await readCachedMedia(cacheKey, mimeType, fileName)

  if (cached) {
    return cached
  }

  if (!mediaUrl) {
    throw new Error("Payload da midia nao contem URL de download.")
  }

  const response = await fetch(mediaUrl, {
    headers: {
      "user-agent": "WhatsApp/2.23.20.0",
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Download da midia falhou com HTTP ${response.status}.`)
  }

  const downloaded = Buffer.from(await response.arrayBuffer())
  const bytes = mediaKey
    ? decryptWhatsAppMedia(downloaded, mediaKey, message.contentType)
    : downloaded

  assertSha256(bytes, firstString(payload.fileSHA256))
  await writeCachedMedia(cacheKey, bytes)

  return { bytes, mimeType, fileName }
}
