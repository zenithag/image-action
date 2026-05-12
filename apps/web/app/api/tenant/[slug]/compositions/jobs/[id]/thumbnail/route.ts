import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"
import sharp from "sharp"

import { getCompositionBaseImageUrl } from "@/lib/composition-image-url"
import type { CompositionJob } from "@/lib/composition-types"
import { findCompositionJob } from "@/lib/server/composition-jobs-store"
import { readGeneratedAsset, saveGeneratedAsset } from "@/lib/server/generated-assets-store"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { getRuntimeGeneratedDir } from "@/lib/server/runtime-paths"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

const maxThumbnailWidth = 1280
const defaultThumbnailWidth = 768

function getThumbnailWidth(request: Request) {
  const url = new URL(request.url)
  const width = Number(url.searchParams.get("w") || defaultThumbnailWidth)

  if (!Number.isFinite(width)) {
    return defaultThumbnailWidth
  }

  return Math.max(96, Math.min(maxThumbnailWidth, Math.round(width)))
}

function getImageKind(request: Request) {
  const url = new URL(request.url)

  return url.searchParams.get("image") === "base" ? "base" : "result"
}

function getSourceUrl(job: CompositionJob, kind: "base" | "result") {
  if (kind === "result" && job.resultImageUrl) {
    return job.resultImageUrl
  }

  if (kind === "base") {
    return job.baseImageUrl || getCompositionBaseImageUrl(job)
  }

  return job.baseImageUrl || getCompositionBaseImageUrl(job)
}

function toAbsoluteImageUrl(value: string) {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value
  }

  return `${getPublicAppBaseUrl()}${value.startsWith("/") ? value : `/${value}`}`
}

function getGeneratedPath(value: string) {
  try {
    const url = /^https?:\/\//i.test(value) ? new URL(value) : null
    const pathname = url ? url.pathname : value

    return pathname.startsWith("/generated/") ? pathname : null
  } catch {
    return null
  }
}

async function readGeneratedSource(generatedPath: string) {
  const persistedAsset = await readGeneratedAsset(generatedPath)

  if (persistedAsset) {
    return persistedAsset.bytes
  }

  const pathSegments = generatedPath
    .replace(/^\/generated\/?/, "")
    .split("/")
    .filter(Boolean)

  if (pathSegments.length === 0 || pathSegments.some((segment) => segment === "..")) {
    return null
  }

  const filePath = getRuntimeGeneratedDir(...pathSegments)
  const fileStat = await stat(filePath).catch(() => null)

  if (!fileStat?.isFile()) {
    return null
  }

  return readFile(filePath)
}

async function readSourceBytes(sourceUrl: string) {
  if (sourceUrl.startsWith("data:")) {
    const match = sourceUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)

    if (!match) {
      throw new Error("Data URL invalida.")
    }

    return Buffer.from(match[1], "base64")
  }

  const generatedPath = getGeneratedPath(sourceUrl)

  if (generatedPath) {
    const bytes = await readGeneratedSource(generatedPath)

    if (!bytes) {
      throw new Error("Arquivo gerado nao encontrado.")
    }

    return bytes
  }

  if (sourceUrl.startsWith("/api/")) {
    throw new Error("Thumbnail nao tenta resolver midia legada do inbox.")
  }

  const response = await fetch(toAbsoluteImageUrl(sourceUrl), {
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Download da imagem falhou com HTTP ${response.status}.`)
  }

  return Buffer.from(await response.arrayBuffer())
}

function getThumbnailGeneratedPath(job: CompositionJob, kind: "base" | "result", width: number) {
  const version = kind === "result"
    ? job.completedAt || job.updatedAt
    : job.baseMessageId || job.updatedAt || job.createdAt
  const versionHash = version
    ? Buffer.from(version).toString("base64url").slice(0, 10)
    : "no-version"

  return `/generated/thumbnails/compositions/${job.id}-${kind}-${width}-${versionHash}.webp`
}

function createImageResponse(bytes: Buffer) {
  const body = new Uint8Array(bytes)

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "image/webp",
    },
  })
}

export async function GET(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const job = await findCompositionJob(slug, id)

  if (!job) {
    return NextResponse.json({ error: "Job de composicao nao encontrado." }, { status: 404 })
  }

  const width = getThumbnailWidth(request)
  const kind = getImageKind(request)
  const sourceUrl = getSourceUrl(job, kind)

  if (!sourceUrl) {
    return NextResponse.json({ error: "Imagem de origem nao encontrada." }, { status: 404 })
  }

  const thumbnailPath = getThumbnailGeneratedPath(job, kind, width)
  const cachedAsset = await readGeneratedAsset(thumbnailPath)

  if (cachedAsset) {
    return createImageResponse(cachedAsset.bytes)
  }

  const thumbnailFilePath = getRuntimeGeneratedDir(...thumbnailPath.replace(/^\/generated\/?/, "").split("/").filter(Boolean))
  const fileStat = await stat(thumbnailFilePath).catch(() => null)

  if (fileStat?.isFile()) {
    return createImageResponse(await readFile(thumbnailFilePath))
  }

  try {
    const sourceBytes = await readSourceBytes(sourceUrl)
    const thumbnailBytes = await sharp(sourceBytes)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 86, effort: 5, smartSubsample: true })
      .toBuffer()

    await mkdir(path.dirname(thumbnailFilePath), { recursive: true })
    await writeFile(thumbnailFilePath, thumbnailBytes)
    await saveGeneratedAsset(thumbnailPath, thumbnailBytes, "image/webp")

    return createImageResponse(thumbnailBytes)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel gerar a miniatura.",
    }, { status: 404 })
  }
}
