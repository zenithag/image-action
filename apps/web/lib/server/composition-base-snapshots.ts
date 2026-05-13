import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CompositionJob } from "@/lib/composition-types"
import { updateCompositionJob } from "@/lib/server/composition-jobs-store"
import { readGeneratedAsset, saveGeneratedAsset } from "@/lib/server/generated-assets-store"
import { normalizeImageForUpload } from "@/lib/server/image-normalization"
import { findInboxMessage } from "@/lib/server/inbox-store"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { getRuntimeGeneratedDir } from "@/lib/server/runtime-paths"
import { resolveWhatsAppMedia } from "@/lib/server/whatsapp-media"

type SnapshotSource = {
  bytes: Buffer
  mimeType: string
}

const durableBasePathPrefix = "/generated/composition-bases/"
const durableBaseOutputDir = getRuntimeGeneratedDir("composition-bases")

export function isDurableCompositionBaseImageUrl(value?: string | null) {
  return value?.startsWith(durableBasePathPrefix) === true
}

function toAbsoluteImageUrl(value: string) {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value
  }

  return `${getPublicAppBaseUrl()}${value.startsWith("/") ? value : `/${value}`}`
}

function isSupportedRasterMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase()

  return normalized.startsWith("image/") && !normalized.includes("svg")
}

function getPublicGeneratedFilePath(imageUrl: string) {
  try {
    const url = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl) : null
    const pathname = url ? url.pathname : imageUrl

    if (!pathname.startsWith("/generated/")) {
      return null
    }

    return getRuntimeGeneratedDir(...pathname.replace(/^\/generated\/?/, "").split("/").filter(Boolean))
  } catch {
    return null
  }
}

async function readGeneratedImageUrl(imageUrl: string): Promise<SnapshotSource | null> {
  const url = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl) : null
  const pathname = url ? url.pathname : imageUrl

  if (!pathname.startsWith("/generated/")) {
    return null
  }

  const persistedAsset = await readGeneratedAsset(pathname)

  if (persistedAsset) {
    return {
      bytes: persistedAsset.bytes,
      mimeType: persistedAsset.mimeType,
    }
  }

  const filePath = getPublicGeneratedFilePath(imageUrl)

  if (!filePath) {
    return null
  }

  const fileStat = await stat(filePath).catch(() => null)

  if (!fileStat?.isFile()) {
    return null
  }

  const extension = path.extname(filePath).toLowerCase()
  const mimeType = extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".webp"
      ? "image/webp"
      : extension === ".avif"
        ? "image/avif"
        : "image/png"

  return {
    bytes: await readFile(filePath),
    mimeType,
  }
}

async function bytesFromImageUrl(imageUrl: string): Promise<SnapshotSource> {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)

    if (!match || !isSupportedRasterMimeType(match[1])) {
      throw new Error("Data URL da imagem base invalida.")
    }

    return {
      bytes: Buffer.from(match[2], "base64"),
      mimeType: match[1],
    }
  }

  const generatedAsset = await readGeneratedImageUrl(imageUrl)

  if (generatedAsset) {
    return generatedAsset
  }

  const response = await fetch(toAbsoluteImageUrl(imageUrl), {
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Download da imagem base falhou com HTTP ${response.status}.`)
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"

  if (!isSupportedRasterMimeType(mimeType)) {
    throw new Error(`URL da imagem base retornou tipo invalido: ${mimeType}.`)
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType,
  }
}

async function resolveSnapshotSource(job: CompositionJob): Promise<SnapshotSource> {
  const failedSources: string[] = []

  if (job.baseMessageId) {
    const message = await findInboxMessage(job.tenantSlug, job.conversationId, job.baseMessageId)

    if (!message) {
      failedSources.push("mensagem base nao encontrada")
    } else if (message.contentType !== "image") {
      failedSources.push("mensagem base nao e imagem")
    } else {
      try {
        const media = await resolveWhatsAppMedia(message)

        return {
          bytes: media.bytes,
          mimeType: media.mimeType,
        }
      } catch (error) {
        failedSources.push(error instanceof Error ? error.message : "falha ao carregar midia da mensagem base")
      }
    }
  }

  if (job.baseImageUrl) {
    try {
      return await bytesFromImageUrl(job.baseImageUrl)
    } catch (error) {
      failedSources.push(error instanceof Error ? error.message : "falha ao carregar URL da imagem base")
    }
  }

  throw new Error(
    failedSources.length > 0
      ? `Nao foi possivel criar snapshot da imagem base: ${failedSources.join("; ")}.`
      : "Job nao possui imagem base vinculada."
  )
}

export async function saveCompositionBaseSnapshot(job: CompositionJob, bytes: Buffer, mimeType: string) {
  if (!isSupportedRasterMimeType(mimeType)) {
    throw new Error(`Imagem base possui tipo invalido: ${mimeType}.`)
  }

  const normalized = await normalizeImageForUpload(bytes, mimeType)
  const resultPath = `${durableBasePathPrefix}${job.id}.${normalized.fileExtension}`
  const filePath = path.join(durableBaseOutputDir, `${job.id}.${normalized.fileExtension}`)

  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, normalized.bytes)
  await saveGeneratedAsset(resultPath, normalized.bytes, normalized.mimeType)

  return resultPath
}

export async function ensureCompositionBaseSnapshot(job: CompositionJob) {
  if (isDurableCompositionBaseImageUrl(job.baseImageUrl)) {
    return job
  }

  const source = await resolveSnapshotSource(job)
  const baseImageUrl = await saveCompositionBaseSnapshot(job, source.bytes, source.mimeType)
  const updatedJob = await updateCompositionJob(job.tenantSlug, job.id, { baseImageUrl })

  return updatedJob ?? {
    ...job,
    baseImageUrl,
  }
}
