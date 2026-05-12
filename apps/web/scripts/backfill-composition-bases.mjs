import { createDecipheriv, createHash, hkdfSync, randomUUID, timingSafeEqual } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import sharp from "sharp"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appDir = join(scriptDir, "..")

for (const envFile of [join(appDir, ".env.local"), join(appDir, ".env")]) {
  if (!existsSync(envFile)) {
    continue
  }

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue
    }

    const index = trimmed.indexOf("=")
    const key = trimmed.slice(0, index).trim()
    const rawValue = trimmed.slice(index + 1).trim()

    process.env[key] ??= rawValue.replace(/^["']|["']$/g, "")
  }
}

const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const dryRun = !apply
const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="))
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="))
const tenantFilter = tenantArg ? tenantArg.slice("--tenant=".length).trim() : ""
const limit = limitArg ? Math.max(0, Number(limitArg.slice("--limit=".length))) : 0

if (args.has("--help") || args.has("-h")) {
  console.log([
    "Usage: pnpm --dir apps/web backfill:composition-bases [--dry-run|--apply] [--tenant=slug] [--limit=N]",
    "",
    "Default mode is --dry-run. Use --apply to persist recovered base snapshots.",
  ].join("\n"))
  process.exit(0)
}

const dataDir = process.env.VISUALFLOW_DATA_DIR?.trim() || join(appDir, ".local")
const publicDir = process.env.VISUALFLOW_PUBLIC_DIR?.trim() || join(appDir, "public")
const generatedDir = join(publicDir, "generated")
const mediaCacheDir = join(dataDir, "inbox-media")
const durableBasePathPrefix = "/generated/composition-bases/"
const databaseUrl = process.env.DATABASE_URL?.trim() || ""

let pool = null

async function getPool() {
  if (!databaseUrl) {
    return null
  }

  if (!pool) {
    const { Pool } = await import("pg")
    pool = new Pool({ connectionString: databaseUrl, max: 2 })
    await pool.query(`
      create table if not exists app_documents (
        key text primary key,
        data jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `)
  }

  return pool
}

async function readJsonFile(filePath, fallback) {
  try {
    return {
      found: true,
      data: JSON.parse(await readFile(filePath, "utf8")),
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { found: false, data: fallback }
    }

    throw error
  }
}

async function writeJsonFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporaryFile = `${filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`

  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  await rename(temporaryFile, filePath)
}

async function readJsonStore(key, filePath, fallback) {
  const activePool = await getPool()

  if (activePool) {
    const result = await activePool.query("select data from app_documents where key = $1", [key])

    if (result.rowCount && result.rows[0]) {
      return result.rows[0].data
    }
  }

  const fileData = await readJsonFile(filePath, fallback)

  if (activePool && fileData.found && apply) {
    await writeJsonStore(key, filePath, fileData.data)
  }

  return fileData.data
}

async function writeJsonStore(key, filePath, data) {
  const activePool = await getPool()

  if (activePool) {
    await activePool.query(
      `
        insert into app_documents (key, data, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key)
        do update set data = excluded.data, updated_at = now()
      `,
      [key, JSON.stringify(data)]
    )
    return
  }

  await writeJsonFile(filePath, data)
}

function getStoreHash(value) {
  return createHash("sha256").update(value).digest("hex")
}

function getGeneratedAssetOptions(generatedPath) {
  const hash = getStoreHash(generatedPath)

  return {
    key: `generated-asset:${hash}`,
    filePath: join(dataDir, "generated-assets", `${hash}.json`),
  }
}

async function readGeneratedAsset(generatedPath) {
  const normalizedPath = normalizeGeneratedPath(generatedPath)

  if (!normalizedPath) {
    return null
  }

  const options = getGeneratedAssetOptions(normalizedPath)
  const asset = await readJsonStore(options.key, options.filePath, null)

  if (!asset?.base64 || !asset?.mimeType) {
    return null
  }

  return {
    bytes: Buffer.from(asset.base64, "base64"),
    mimeType: asset.mimeType,
  }
}

async function saveGeneratedAsset(generatedPath, bytes, mimeType) {
  const normalizedPath = normalizeGeneratedPath(generatedPath)

  if (!normalizedPath || dryRun) {
    return
  }

  const options = getGeneratedAssetOptions(normalizedPath)

  await writeJsonStore(options.key, options.filePath, {
    path: normalizedPath,
    mimeType,
    base64: bytes.toString("base64"),
    size: bytes.byteLength,
    createdAt: new Date().toISOString(),
  })
}

function normalizeGeneratedPath(value) {
  const text = typeof value === "string" ? value.trim() : ""

  if (!text.startsWith("/generated/") || text.includes("..")) {
    return null
  }

  return text
}

function asRecord(value) {
  return typeof value === "object" && value !== null ? value : {}
}

function asString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function firstString(...values) {
  for (const value of values) {
    const text = asString(value)

    if (text) {
      return text
    }
  }

  return ""
}

function getContentKey(contentType) {
  if (contentType === "image") return "imageMessage"
  if (contentType === "audio") return "audioMessage"
  if (contentType === "video") return "videoMessage"
  if (contentType === "file") return "documentMessage"

  return "message"
}

function getRawMediaPayload(message) {
  const rawPayload = asRecord(message.rawPayload)
  const content = asRecord(rawPayload.content)

  if (Object.keys(content).length > 0) {
    return content
  }

  const rootMessage = asRecord(rawPayload.message)
  const directMedia = asRecord(rootMessage[getContentKey(message.contentType)])

  if (Object.keys(directMedia).length > 0) {
    return directMedia
  }

  if (message.contentType === "file") {
    return asRecord(asRecord(asRecord(rootMessage.documentWithCaptionMessage).message).documentMessage)
  }

  return rawPayload
}

function getWhatsAppMediaType(contentType) {
  if (contentType === "image") return "Image"
  if (contentType === "audio") return "Audio"
  if (contentType === "video") return "Video"
  if (contentType === "file") return "Document"

  return "Document"
}

function getFallbackMimeType(contentType) {
  if (contentType === "image") return "image/jpeg"
  if (contentType === "audio") return "audio/ogg"
  if (contentType === "video") return "video/mp4"
  if (contentType === "file") return "application/octet-stream"

  return "application/octet-stream"
}

function getMediaUrl(payload, message) {
  return firstString(
    payload.URL,
    payload.url,
    payload.mediaUrl,
    payload.downloadUrl,
    payload.fileUrl,
    payload.fileURL,
    message.mediaUrl,
    message.imageUrl
  )
}

function getCacheKey(message) {
  return createHash("sha256")
    .update(`${message.id}:${message.providerMessageId ?? ""}:${message.contentType}`)
    .digest("hex")
}

async function readCachedMedia(message, mimeType) {
  try {
    return await readFile(join(mediaCacheDir, `${getCacheKey(message)}.bin`))
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null
    }

    throw error
  }
}

function buildMediaKeys(mediaKey, contentType) {
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

function decryptWhatsAppMedia(encrypted, mediaKey, contentType) {
  const encryptedBody = encrypted.length > 10 ? encrypted.subarray(0, -10) : encrypted
  const { iv, cipherKey } = buildMediaKeys(mediaKey, contentType)
  const decipher = createDecipheriv("aes-256-cbc", cipherKey, iv)

  return Buffer.concat([decipher.update(encryptedBody), decipher.final()])
}

function assertSha256(bytes, expectedSha256) {
  if (!expectedSha256) {
    return
  }

  const actual = createHash("sha256").update(bytes).digest()
  const expected = Buffer.from(expectedSha256, "base64")

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Checksum da midia recebida nao confere.")
  }
}

function getDataUrlMedia(value) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i)

  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  }
}

async function readGeneratedImageUrl(imageUrl) {
  const url = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl) : null
  const pathname = url ? url.pathname : imageUrl

  if (!pathname.startsWith("/generated/")) {
    return null
  }

  const persistedAsset = await readGeneratedAsset(pathname)

  if (persistedAsset) {
    return persistedAsset
  }

  const filePath = join(generatedDir, ...pathname.replace(/^\/generated\/?/, "").split("/").filter(Boolean))
  const fileStat = await stat(filePath).catch(() => null)

  if (!fileStat?.isFile()) {
    return null
  }

  return {
    bytes: await readFile(filePath),
    mimeType: "image/png",
  }
}

async function resolveMessageMedia(message) {
  if (message.contentType !== "image") {
    throw new Error("Mensagem base nao e imagem.")
  }

  const payload = getRawMediaPayload(message)
  const mediaUrl = getMediaUrl(payload, message)
  const mediaKey = firstString(payload.mediaKey)
  const mimeType = firstString(payload.mimetype, payload.mimeType, message.mediaMimeType) || getFallbackMimeType(message.contentType)
  const cached = await readCachedMedia(message, mimeType)

  if (cached) {
    return { bytes: cached, mimeType }
  }

  if (!mediaUrl) {
    throw new Error("Payload da midia nao contem URL de download.")
  }

  const dataUrlMedia = getDataUrlMedia(mediaUrl)

  if (dataUrlMedia) {
    return dataUrlMedia
  }

  const generatedMedia = await readGeneratedImageUrl(mediaUrl)

  if (generatedMedia) {
    return generatedMedia
  }

  if (!/^https?:\/\//i.test(mediaUrl)) {
    throw new Error(`URL local nao recuperavel pelo script: ${mediaUrl.slice(0, 120)}.`)
  }

  const response = await fetch(mediaUrl, {
    headers: { "user-agent": "WhatsApp/2.23.20.0" },
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

  return { bytes, mimeType }
}

function extractMediaRouteMessageId(value) {
  if (!value) {
    return ""
  }

  const url = /^https?:\/\//i.test(value) ? new URL(value) : null
  const pathname = url ? url.pathname : value
  const match = pathname.match(/\/messages\/([^/]+)\/media(?:$|\?)/)

  return match ? decodeURIComponent(match[1]) : ""
}

async function bytesFromImageUrl(imageUrl) {
  const dataUrlMedia = getDataUrlMedia(imageUrl)

  if (dataUrlMedia) {
    return dataUrlMedia
  }

  const generatedMedia = await readGeneratedImageUrl(imageUrl)

  if (generatedMedia) {
    return generatedMedia
  }

  if (imageUrl.startsWith("/api/")) {
    throw new Error("URL interna de inbox sem mensagem recuperavel.")
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error(`URL de imagem base nao suportada: ${imageUrl.slice(0, 120)}.`)
  }

  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) })

  if (!response.ok) {
    throw new Error(`Download da imagem base falhou com HTTP ${response.status}.`)
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"

  if (!mimeType.startsWith("image/") || mimeType.includes("svg")) {
    throw new Error(`URL da imagem base retornou tipo invalido: ${mimeType}.`)
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType,
  }
}

async function resolveSnapshotSource(job, messagesById) {
  const messageId = job.baseMessageId || extractMediaRouteMessageId(job.baseImageUrl || "")

  if (messageId) {
    const message = messagesById.get(messageId)

    if (message) {
      return resolveMessageMedia(message)
    }
  }

  if (job.baseImageUrl) {
    return bytesFromImageUrl(job.baseImageUrl)
  }

  throw new Error("Job nao possui imagem base vinculada.")
}

async function saveSnapshot(job, source) {
  const bytes = await sharp(source.bytes)
    .rotate()
    .png()
    .toBuffer()
  const generatedPath = `${durableBasePathPrefix}${job.id}.png`
  const filePath = join(generatedDir, "composition-bases", `${job.id}.png`)

  if (apply) {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, bytes)
    await saveGeneratedAsset(generatedPath, bytes, "image/png")
  }

  return generatedPath
}

function isCompletedRecoverableJob(job) {
  return job?.status === "done" && Boolean(job.resultImageUrl)
}

async function main() {
  const [compositionData, inboxData] = await Promise.all([
    readJsonStore("composition-jobs", join(dataDir, "composition-jobs.json"), { jobs: [] }),
    readJsonStore("inbox-conversations", join(dataDir, "inbox-conversations.json"), { conversations: [], messages: [] }),
  ])
  const messagesById = new Map((inboxData.messages || []).map((message) => [message.id, message]))
  const jobs = Array.isArray(compositionData.jobs) ? compositionData.jobs : []
  const selectedJobs = jobs
    .filter((job) => isCompletedRecoverableJob(job))
    .filter((job) => !tenantFilter || job.tenantSlug === tenantFilter)
    .slice(0, limit > 0 ? limit : undefined)
  const report = {
    mode: apply ? "apply" : "dry-run",
    scanned: selectedJobs.length,
    alreadyPersisted: 0,
    recoverable: 0,
    updated: 0,
    unrecoverable: [],
  }
  let changed = false

  for (const job of selectedJobs) {
    if (typeof job.baseImageUrl === "string" && job.baseImageUrl.startsWith(durableBasePathPrefix)) {
      report.alreadyPersisted += 1
      continue
    }

    try {
      const source = await resolveSnapshotSource(job, messagesById)
      const baseImageUrl = await saveSnapshot(job, source)

      report.recoverable += 1

      if (apply) {
        job.baseImageUrl = baseImageUrl
        job.updatedAt = new Date().toISOString()
        report.updated += 1
        changed = true
      }
    } catch (error) {
      report.unrecoverable.push({
        id: job.id,
        tenantSlug: job.tenantSlug,
        createdAt: job.createdAt,
        baseMessageId: job.baseMessageId,
        reason: error instanceof Error ? error.message : "Falha desconhecida.",
      })
    }
  }

  if (apply && changed) {
    await writeJsonStore("composition-jobs", join(dataDir, "composition-jobs.json"), compositionData)
  }

  console.log(JSON.stringify({
    ...report,
    unrecoverableCount: report.unrecoverable.length,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (pool) {
      await pool.end()
    }
  })
