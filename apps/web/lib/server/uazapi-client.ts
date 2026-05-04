import { readFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import type { StoredProvider } from "@/lib/server/channel-providers-store"
import type { InboxMessageContentType } from "@/lib/inbox-types"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { getRuntimePublicDir } from "@/lib/server/runtime-paths"

export type UazapiInstancePayload = {
  id?: string
  token?: string
  status?: string
  qrcode?: string
  paircode?: string
  name?: string
  profileName?: string
  profilePicUrl?: string
  owner?: string
  adminField01?: string
  adminField02?: string
}

export type UazapiResponseBody = {
  response?: string
  instance?: UazapiInstancePayload
  status?: {
    connected?: boolean
    loggedIn?: boolean
    jid?: {
      user?: string
    } | null
  }
  connected?: boolean
  loggedIn?: boolean
  jid?: {
    user?: string
  } | null
  name?: string
  owner?: string
  token?: string
  qrcode?: string
  paircode?: string
  error?: string
  message?: string
}

export type UazapiChat = {
  wa_chatid?: string
  wa_fastid?: string
  wa_name?: string
  wa_contactName?: string
  name?: string
  wa_lastMsgTimestamp?: number | string
}

export type UazapiMessage = {
  id?: string
  messageid?: string
  messageId?: string
  owner?: string
  fromMe?: boolean
  messageType?: string
  type?: string
  messageBody?: string
  text?: string
  content?: string
  body?: string
  caption?: string
  url?: string
  mediaUrl?: string
  downloadUrl?: string
  fileUrl?: string
  imageUrl?: string
  audioUrl?: string
  videoUrl?: string
  documentUrl?: string
  mimetype?: string
  mimeType?: string
  fileName?: string
  filename?: string
  fileLength?: number
  fileSize?: number
  seconds?: number
  duration?: number
  messageTimestamp?: number | string
  timestamp?: number | string
  createdAt?: string
  created_at?: string
  date?: string
  message?: {
    conversation?: string
    extendedTextMessage?: {
      text?: string
    }
    imageMessage?: UazapiMediaMessage
    audioMessage?: UazapiMediaMessage
    videoMessage?: UazapiMediaMessage
    documentMessage?: UazapiMediaMessage
    stickerMessage?: UazapiMediaMessage
    documentWithCaptionMessage?: {
      message?: {
        documentMessage?: UazapiMediaMessage
      }
    }
  }
}

export type UazapiMediaMessage = {
  caption?: string
  URL?: string
  url?: string
  mediaUrl?: string
  downloadUrl?: string
  fileUrl?: string
  directPath?: string
  JPEGThumbnail?: string
  mimetype?: string
  mimeType?: string
  fileName?: string
  filename?: string
  fileLength?: number | string
  fileSize?: number | string
  seconds?: number
  duration?: number
}

export type NormalizedUazapiMessageContent = {
  text: string
  contentType: InboxMessageContentType
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaSize?: number
  mediaDurationSeconds?: number
}

export class UazapiError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    readonly body?: unknown
  ) {
    super(message)
    this.name = "UazapiError"
  }
}

export function appendUazapiPath(baseUrl: string, pathname: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`
}

async function readBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text.slice(0, 500)
  }
}

function getBodyMessage(body: unknown, fallback: string) {
  if (typeof body === "object" && body && "message" in body) {
    return String((body as { message?: unknown }).message || fallback)
  }

  if (typeof body === "object" && body && "error" in body) {
    return String((body as { error?: unknown }).error || fallback)
  }

  return fallback
}

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

function normalizeUazapiRecipient(value: string) {
  const contact = value.trim()

  if (!contact) {
    return contact
  }

  const jidMatch = contact.match(/^(.+)@([a-z0-9.-]+)$/i)

  if (jidMatch) {
    const [, user, domain] = jidMatch
    const normalizedDomain = domain.toLowerCase()

    if (normalizedDomain === "s.whatsapp.net" || normalizedDomain === "c.us") {
      const digits = user.replace(/\D/g, "")

      return digits || user
    }

    return contact
  }

  const digits = contact.replace(/\D/g, "")

  return digits || contact
}

function asFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function includesType(value: unknown, pattern: string) {
  return asString(value).toLowerCase().includes(pattern)
}

function getNestedMedia(message: UazapiMessage, key: string) {
  const topLevelMedia = asRecord((message as unknown as Record<string, unknown>)[key])
  if (Object.keys(topLevelMedia).length > 0) {
    return topLevelMedia
  }

  const rootMessage = asRecord(message.message)
  const directMedia = asRecord(rootMessage[key])

  if (Object.keys(directMedia).length > 0) {
    return directMedia
  }

  if (key === "documentMessage") {
    return asRecord(asRecord(asRecord(rootMessage.documentWithCaptionMessage).message).documentMessage)
  }

  return {}
}

function getMessageMediaType(message: UazapiMessage): InboxMessageContentType {
  if (
    includesType(message.messageType, "image") ||
    includesType(message.type, "image") ||
    Boolean(message.imageUrl) ||
    Object.keys(getNestedMedia(message, "imageMessage")).length > 0
  ) {
    return "image"
  }

  if (
    includesType(message.messageType, "audio") ||
    includesType(message.type, "audio") ||
    Boolean(message.audioUrl) ||
    Object.keys(getNestedMedia(message, "audioMessage")).length > 0
  ) {
    return "audio"
  }

  if (
    includesType(message.messageType, "video") ||
    includesType(message.type, "video") ||
    Boolean(message.videoUrl) ||
    Object.keys(getNestedMedia(message, "videoMessage")).length > 0
  ) {
    return "video"
  }

  if (
    includesType(message.messageType, "document") ||
    includesType(message.type, "document") ||
    Boolean(message.documentUrl) ||
    Object.keys(getNestedMedia(message, "documentMessage")).length > 0
  ) {
    return "file"
  }

  if (
    includesType(message.messageType, "sticker") ||
    includesType(message.type, "sticker") ||
    Object.keys(getNestedMedia(message, "stickerMessage")).length > 0
  ) {
    return "image"
  }

  return "text"
}

function getMediaRecord(message: UazapiMessage, contentType: InboxMessageContentType) {
  const content = asRecord(message.content)
  if (Object.keys(content).length > 0 && contentType !== "text") {
    return content
  }

  if (contentType === "image") {
    const image = getNestedMedia(message, "imageMessage")
    if (Object.keys(image).length > 0) return image

    return getNestedMedia(message, "stickerMessage")
  }

  if (contentType === "audio") {
    return getNestedMedia(message, "audioMessage")
  }

  if (contentType === "video") {
    return getNestedMedia(message, "videoMessage")
  }

  if (contentType === "file") {
    return getNestedMedia(message, "documentMessage")
  }

  return {}
}

function getMediaFallbackLabel(contentType: InboxMessageContentType) {
  if (contentType === "image") return "Imagem recebida"
  if (contentType === "audio") return "Audio recebido"
  if (contentType === "video") return "Video recebido"
  if (contentType === "file") return "Arquivo recebido"

  return "Mensagem recebida"
}

export function normalizeUazapiMessageContent(message: UazapiMessage): NormalizedUazapiMessageContent {
  const rootMessage = asRecord(message.message)
  const extendedTextMessage = asRecord(rootMessage.extendedTextMessage)
  const contentType = getMessageMediaType(message)
  const media = getMediaRecord(message, contentType)
  const text = firstString(
    message.text,
    message.messageBody,
    message.content,
    message.body,
    message.caption,
    rootMessage.conversation,
    extendedTextMessage.text,
    media.caption
  )
  const mediaUrl = firstString(
    media.URL,
    media.url,
    media.mediaUrl,
    media.downloadUrl,
    media.fileUrl,
    message.mediaUrl,
    message.downloadUrl,
    message.fileUrl,
    contentType === "image" ? message.imageUrl : undefined,
    contentType === "audio" ? message.audioUrl : undefined,
    contentType === "video" ? message.videoUrl : undefined,
    contentType === "file" ? message.documentUrl : undefined,
    message.url
  )
  const mediaMimeType = firstString(media.mimetype, media.mimeType, message.mimetype, message.mimeType) || undefined
  const mediaFileName = firstString(media.fileName, media.filename, message.fileName, message.filename) || undefined
  const mediaSize = asFiniteNumber(media.fileLength ?? media.fileSize ?? message.fileLength ?? message.fileSize)
  const mediaDurationSeconds = asFiniteNumber(media.seconds ?? media.duration ?? message.seconds ?? message.duration)

  return {
    text,
    contentType,
    mediaUrl: mediaUrl || undefined,
    mediaMimeType,
    mediaFileName,
    mediaSize,
    mediaDurationSeconds,
  }
}

function assertUazapiProvider(provider: StoredProvider) {
  if (provider.provider !== "uazapi" || !provider.baseUrl || !provider.adminToken) {
    throw new UazapiError("Provider UAZAPI incompleto.")
  }
}

function assertUazapiBaseUrl(provider: StoredProvider) {
  if (provider.provider !== "uazapi" || !provider.baseUrl) {
    throw new UazapiError("Provider UAZAPI sem Base URL.")
  }
}

export function normalizeQrCode(qrcode?: string) {
  if (!qrcode) {
    return undefined
  }

  return qrcode.startsWith("data:image") ? qrcode : `data:image/png;base64,${qrcode}`
}

export function getUazapiInstance(body: UazapiResponseBody) {
  return body.instance ?? {
    id: undefined,
    token: body.token,
    status: undefined,
    qrcode: body.qrcode,
    paircode: body.paircode,
    name: body.name,
  }
}

export function getUazapiConnectionState(body: UazapiResponseBody) {
  const connected = body.status?.connected ?? body.connected ?? false
  const loggedIn = body.status?.loggedIn ?? body.loggedIn ?? false
  const phoneNumber = body.status?.jid?.user ?? body.jid?.user ?? body.instance?.owner ?? body.owner

  return { connected, loggedIn, phoneNumber }
}

export async function listUazapiInstances(provider: StoredProvider) {
  assertUazapiProvider(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/instance/all"), {
    method: "GET",
    headers: {
      accept: "application/json",
      admintoken: provider.adminToken!,
    },
    signal: AbortSignal.timeout(15000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return Array.isArray(body) ? body as UazapiInstancePayload[] : []
}

export async function createUazapiInstance(provider: StoredProvider, tenantSlug: string, name: string) {
  assertUazapiProvider(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/instance/create"), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      admintoken: provider.adminToken!,
    },
    body: JSON.stringify({
      name,
      systemName: "ComoFica",
      adminField01: tenantSlug,
      adminField02: provider.id,
    }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return body as UazapiResponseBody
}

export async function connectUazapiInstance(provider: StoredProvider, instanceToken: string) {
  assertUazapiProvider(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/instance/connect"), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return body as UazapiResponseBody
}

export async function getUazapiInstanceStatus(provider: StoredProvider, instanceToken: string) {
  assertUazapiProvider(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/instance/status"), {
    method: "GET",
    headers: {
      accept: "application/json",
      token: instanceToken,
    },
    signal: AbortSignal.timeout(15000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return body as UazapiResponseBody
}

export async function deleteUazapiInstance(provider: StoredProvider, instanceToken: string) {
  assertUazapiBaseUrl(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/instance"), {
    method: "DELETE",
    headers: {
      accept: "application/json",
      token: instanceToken,
    },
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return body as UazapiResponseBody
}

export async function sendUazapiText(provider: StoredProvider, instanceToken: string, number: string, text: string) {
  assertUazapiBaseUrl(provider)
  const recipient = normalizeUazapiRecipient(number)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/send/text"), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify({
      number: recipient,
      text,
      readchat: true,
    }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return body as UazapiResponseBody & {
    id?: string
    messageid?: string
  }
}

type UazapiSendMediaResponse = UazapiResponseBody & {
  id?: string
  messageid?: string
}

function getDataUrlMedia(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i)

  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    base64: match[2],
  }
}

function getMediaMimeType(imageUrl: string) {
  return getDataUrlMedia(imageUrl)?.mimeType || "image/png"
}

function getPublicMediaUrl(imageUrl: string) {
  if (!imageUrl.startsWith("/")) {
    return imageUrl
  }

  return new URL(imageUrl, getPublicAppBaseUrl()).toString()
}

function getPublicFilePathFromMediaUrl(imageUrl: string) {
  if (!imageUrl) {
    return null
  }

  try {
    const url = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl) : null
    const pathname = url ? url.pathname : imageUrl
    const isLocalhost = url ? ["localhost", "127.0.0.1", "::1"].includes(url.hostname) : true

    if (!isLocalhost || !pathname.startsWith("/generated/")) {
      return null
    }

    return path.join(getRuntimePublicDir(), pathname.replace(/^\/+/, ""))
  } catch {
    return null
  }
}

async function getMediaBytes(imageUrl: string, options: { allowRemote?: boolean } = {}) {
  const dataUrlMedia = getDataUrlMedia(imageUrl)

  if (dataUrlMedia) {
    return Buffer.from(dataUrlMedia.base64, "base64")
  }

  const publicFilePath = getPublicFilePathFromMediaUrl(imageUrl)

  if (publicFilePath) {
    try {
      return await readFile(publicFilePath)
    } catch {
      return null
    }
  }

  if (!options.allowRemote) {
    return null
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    return null
  }

  const response = await fetch(imageUrl, {
    headers: { accept: "image/*,*/*" },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    return null
  }

  return Buffer.from(await response.arrayBuffer())
}

async function prepareImageBytesForWhatsapp(bytes: Buffer, mimeType: string) {
  if (!mimeType.startsWith("image/")) {
    return { bytes, mimeType }
  }

  try {
    const metadata = await sharp(bytes).metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0

    if (bytes.length <= 900_000 && width <= 1600 && height <= 1600 && mimeType.includes("jpeg")) {
      return { bytes, mimeType }
    }

    const optimized = await sharp(bytes)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer()

    return {
      bytes: optimized,
      mimeType: "image/jpeg",
    }
  } catch {
    return { bytes, mimeType }
  }
}

async function postUazapiJson(
  provider: StoredProvider,
  instanceToken: string,
  pathname: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const response = await fetch(appendUazapiPath(provider.baseUrl!, pathname), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token: instanceToken,
      ...headers,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  })
  const responseBody = await readBody(response)

  return { response, body: responseBody }
}

async function postUazapiMultipart(
  provider: StoredProvider,
  instanceToken: string,
  pathname: string,
  formData: FormData,
  headers: Record<string, string> = {},
) {
  const response = await fetch(appendUazapiPath(provider.baseUrl!, pathname), {
    method: "POST",
    headers: {
      accept: "application/json",
      token: instanceToken,
      ...headers,
    },
    body: formData,
    signal: AbortSignal.timeout(30000),
  })
  const responseBody = await readBody(response)

  return { response, body: responseBody }
}

function shouldTryMediaFallback(status: number) {
  return status === 400 || status === 404 || status === 405 || status === 422
}

export async function sendUazapiImage(
  provider: StoredProvider,
  instanceToken: string,
  number: string,
  imageUrl: string,
  caption?: string,
  instanceName?: string,
) {
  assertUazapiBaseUrl(provider)
  const recipient = normalizeUazapiRecipient(number)
  const publicImageUrl = getPublicMediaUrl(imageUrl)
  const embeddedMediaBytes = await getMediaBytes(imageUrl)
  const shouldSendAsUpload = Boolean(embeddedMediaBytes)

  const legacyResult = shouldSendAsUpload
    ? null
    : await postUazapiJson(
      provider,
      instanceToken,
      "/send/image",
      {
        number: recipient,
        url: publicImageUrl,
        caption,
        readchat: true,
      },
    )

  if (legacyResult?.response.ok) {
    return legacyResult.body as UazapiSendMediaResponse
  }

  if (legacyResult && !shouldTryMediaFallback(legacyResult.response.status)) {
    throw new UazapiError(
      getBodyMessage(legacyResult.body, `UAZAPI respondeu HTTP ${legacyResult.response.status}.`),
      legacyResult.response.status,
      legacyResult.body,
    )
  }

  const initialMimeType = getMediaMimeType(imageUrl)
  const preparedEmbeddedMedia = embeddedMediaBytes
    ? await prepareImageBytesForWhatsapp(embeddedMediaBytes, initialMimeType)
    : null
  const mimeType = preparedEmbeddedMedia?.mimeType ?? initialMimeType
  const media = preparedEmbeddedMedia ? preparedEmbeddedMedia.bytes.toString("base64") : null
  const fileName = mimeType.includes("jpeg") || mimeType.includes("jpg")
    ? "imagem.jpg"
    : "imagem.png"
  const uazapiMediaBody = {
    number: recipient,
    type: "image",
    file: media,
    text: caption,
    caption,
    readchat: true,
  }
  const flatMediaBody = {
    number: recipient,
    mediatype: "image",
    mimetype: mimeType,
    caption,
    media,
    fileName,
    delay: 200,
  }
  const nestedMediaBody = {
    number: recipient,
    mediaMessage: {
      mediatype: "image",
      mimetype: mimeType,
      fileName,
      caption,
      media,
    },
    options: {
      delay: 200,
    },
  }
  const endpointInstances = [...new Set(
    [instanceName, instanceToken]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
  )]
  const fallbackAttempts: Array<{
    pathname: string
    body: Record<string, unknown>
    headers: Record<string, string>
  }> = [
    ...(media ? [{
      pathname: "/send/media",
      body: uazapiMediaBody,
      headers: {},
    }] : []),
    ...(media ? endpointInstances.flatMap((endpointInstance) => [
      {
        pathname: `/message/sendMedia/${encodeURIComponent(endpointInstance)}`,
        body: flatMediaBody,
        headers: { apikey: instanceToken },
      },
      {
        pathname: `/message/sendMedia/${encodeURIComponent(endpointInstance)}`,
        body: nestedMediaBody,
        headers: { apikey: instanceToken },
      },
    ]) : [])]

  fallbackAttempts.push(
    ...(media ? [{
      pathname: "/message/sendMedia",
      body: flatMediaBody,
      headers: { apikey: instanceToken },
    },
    {
      pathname: "/message/sendMedia",
      body: nestedMediaBody,
      headers: { apikey: instanceToken },
    }] : []),
    {
      pathname: "/send/media",
      body: {
        number: recipient,
        type: "image",
        mediaType: "image",
        mimetype: mimeType,
        url: publicImageUrl,
        caption,
        text: caption,
        fileName,
        readchat: true,
      },
      headers: {},
    },
  )
  let lastResult = legacyResult
  let lastAttempt = shouldSendAsUpload ? "upload local" : "/send/image json"

  for (const attempt of fallbackAttempts) {
    const result = await postUazapiJson(provider, instanceToken, attempt.pathname, attempt.body, attempt.headers)

    if (result.response.ok) {
      return result.body as UazapiSendMediaResponse
    }

    lastResult = result
    lastAttempt = `${attempt.pathname} json`
  }

  const mediaBytes = preparedEmbeddedMedia?.bytes ??
    embeddedMediaBytes ??
    await getMediaBytes(publicImageUrl, { allowRemote: true })

  if (mediaBytes) {
    const multipartAttempts: Array<{ pathname: string; headers: Record<string, string> }> = [
      ...endpointInstances.map((endpointInstance) => ({
        pathname: `/message/sendMedia/${encodeURIComponent(endpointInstance)}`,
        headers: { apikey: instanceToken },
      })),
      { pathname: "/send/image", headers: {} },
      { pathname: "/send/media", headers: {} },
      { pathname: "/message/sendMedia", headers: { apikey: instanceToken } },
    ]
    const multipartMedia = preparedEmbeddedMedia ?? await prepareImageBytesForWhatsapp(mediaBytes, mimeType)
    const file = new Blob([new Uint8Array(multipartMedia.bytes)], { type: multipartMedia.mimeType })
    const multipartFileName = multipartMedia.mimeType.includes("jpeg") || multipartMedia.mimeType.includes("jpg")
      ? "imagem.jpg"
      : fileName

    for (const attempt of multipartAttempts) {
      const formData = new FormData()
      formData.append("number", recipient)
      formData.append("caption", caption ?? "")
      formData.append("type", "image")
      formData.append("mediaType", "image")
      formData.append("mediatype", "image")
      formData.append("mimetype", multipartMedia.mimeType)
      formData.append("fileName", multipartFileName)
      formData.append("readchat", "true")
      formData.append("file", file, multipartFileName)

      const result = await postUazapiMultipart(provider, instanceToken, attempt.pathname, formData, attempt.headers)

      if (result.response.ok) {
        return result.body as UazapiSendMediaResponse
      }

      lastResult = result
      lastAttempt = `${attempt.pathname} multipart`
    }
  }

  throw new UazapiError(
    lastResult
      ? `${lastAttempt}: ${getBodyMessage(lastResult.body, `UAZAPI respondeu HTTP ${lastResult.response.status}.`)}`
      : `${lastAttempt}: nao foi possivel carregar a midia local para upload.`,
    lastResult?.response.status,
    lastResult?.body,
  )
}

export async function configureUazapiWebhook(provider: StoredProvider, instanceToken: string, url: string) {
  assertUazapiBaseUrl(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/webhook"), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify({
      enabled: true,
      url,
      events: ["messages", "history", "connection"],
      excludeMessages: ["wasSentByApi", "fromMeYes", "isGroupYes"],
      addUrlEvents: false,
      addUrlTypesMessages: false,
      action: "add",
    }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  return body
}

export async function findUazapiChats(provider: StoredProvider, instanceToken: string, limit = 20) {
  assertUazapiBaseUrl(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/chat/find"), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify({
      operator: "AND",
      sort: "-wa_lastMsgTimestamp",
      limit,
      offset: 0,
      wa_isGroup: false,
    }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  if (typeof body === "object" && body && Array.isArray((body as { chats?: unknown }).chats)) {
    return (body as { chats: UazapiChat[] }).chats
  }

  return []
}

export async function findUazapiMessages(provider: StoredProvider, instanceToken: string, chatid: string, limit = 20) {
  assertUazapiBaseUrl(provider)

  const response = await fetch(appendUazapiPath(provider.baseUrl!, "/message/find"), {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      token: instanceToken,
    },
    body: JSON.stringify({
      chatid,
      limit,
      offset: 0,
    }),
    signal: AbortSignal.timeout(20000),
  })

  const body = await readBody(response)

  if (!response.ok) {
    throw new UazapiError(getBodyMessage(body, `UAZAPI respondeu HTTP ${response.status}.`), response.status, body)
  }

  if (typeof body === "object" && body && Array.isArray((body as { messages?: unknown }).messages)) {
    return (body as { messages: UazapiMessage[] }).messages
  }

  return []
}
