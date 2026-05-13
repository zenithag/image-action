import { createHash } from "node:crypto"

import { deleteJsonStore, readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type GeneratedAssetData = {
  path: string
  mimeType: string
  base64: string
  size: number
  createdAt: string
}

function normalizeGeneratedPath(value: string) {
  const path = value.trim()

  if (!path.startsWith("/generated/") || path.includes("..")) {
    return null
  }

  return path
}

function getStoreHash(path: string) {
  return createHash("sha256").update(path).digest("hex")
}

function getStoreOptions(path: string) {
  const hash = getStoreHash(path)

  return {
    key: `generated-asset:${hash}`,
    filePath: getRuntimeDataFile(`generated-assets/${hash}.json`),
    fallback: null as GeneratedAssetData | null,
    normalize: (value: unknown): GeneratedAssetData | null => {
      const record = typeof value === "object" && value ? value as Partial<GeneratedAssetData> : null

      if (
        !record ||
        typeof record.path !== "string" ||
        typeof record.mimeType !== "string" ||
        typeof record.base64 !== "string"
      ) {
        return null
      }

      return {
        path: record.path,
        mimeType: record.mimeType,
        base64: record.base64,
        size: typeof record.size === "number" ? record.size : Buffer.byteLength(record.base64, "base64"),
        createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      }
    },
  }
}

export async function saveGeneratedAsset(path: string, bytes: Buffer, mimeType: string) {
  const normalizedPath = normalizeGeneratedPath(path)

  if (!normalizedPath) {
    return
  }

  await writeJsonStore(getStoreOptions(normalizedPath), {
    path: normalizedPath,
    mimeType,
    base64: bytes.toString("base64"),
    size: bytes.byteLength,
    createdAt: new Date().toISOString(),
  })
}

export async function readGeneratedAsset(path: string) {
  const normalizedPath = normalizeGeneratedPath(path)

  if (!normalizedPath) {
    return null
  }

  const asset = await readJsonStore(getStoreOptions(normalizedPath))

  if (!asset) {
    return null
  }

  return {
    bytes: Buffer.from(asset.base64, "base64"),
    mimeType: asset.mimeType,
    size: asset.size,
  }
}

export async function deleteGeneratedAsset(path: string) {
  const normalizedPath = normalizeGeneratedPath(path)

  if (!normalizedPath) {
    return false
  }

  return deleteJsonStore(getStoreOptions(normalizedPath))
}
