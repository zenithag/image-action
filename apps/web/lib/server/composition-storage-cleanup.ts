import { readdir, rm, stat } from "node:fs/promises"

import type { CompositionJob } from "@/lib/composition-types"
import { purgeTenantCompositionJobs } from "@/lib/server/composition-jobs-store"
import { deleteGeneratedAsset } from "@/lib/server/generated-assets-store"
import { getRuntimeGeneratedDir } from "@/lib/server/runtime-paths"

export type CompositionStorageCleanupResult = {
  ok: boolean
  deletedJobs: number
  deletedFiles: number
  deletedGeneratedAssets: number
  freedBytes: number
  failedFiles: Array<{ path: string; error: string }>
  processingJobs: Array<{ id: string; contactName: string }>
}

function getGeneratedPath(value?: string) {
  if (!value || value.startsWith("data:")) {
    return null
  }

  try {
    const url = /^https?:\/\//i.test(value) ? new URL(value) : null
    const pathname = url ? url.pathname : value.split("?")[0]

    if (!pathname.startsWith("/generated/") || pathname.includes("..")) {
      return null
    }

    return pathname
  } catch {
    return null
  }
}

function getGeneratedFilePath(generatedPath: string) {
  return getRuntimeGeneratedDir(
    ...generatedPath.replace(/^\/generated\/?/, "").split("/").filter(Boolean)
  )
}

function isJobFile(fileName: string, jobId: string) {
  return (
    fileName === jobId ||
    fileName.startsWith(`${jobId}.`) ||
    fileName.startsWith(`${jobId}-`)
  )
}

async function collectExistingJobFiles(jobs: CompositionJob[]) {
  const generatedPaths = new Set<string>()
  const jobIds = new Set(jobs.map((job) => job.id))
  const directories = [
    { generatedPrefix: "/generated/compositions", fileDir: getRuntimeGeneratedDir("compositions") },
    { generatedPrefix: "/generated/composition-bases", fileDir: getRuntimeGeneratedDir("composition-bases") },
    { generatedPrefix: "/generated/thumbnails/compositions", fileDir: getRuntimeGeneratedDir("thumbnails", "compositions") },
  ]

  for (const directory of directories) {
    let entries: string[] = []

    try {
      entries = await readdir(directory.fileDir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }

    for (const fileName of entries) {
      for (const jobId of jobIds) {
        if (!isJobFile(fileName, jobId)) {
          continue
        }

        generatedPaths.add(`${directory.generatedPrefix}/${fileName}`)
        break
      }
    }
  }

  return generatedPaths
}

function collectReferencedGeneratedPaths(jobs: CompositionJob[]) {
  const generatedPaths = new Set<string>()

  for (const job of jobs) {
    const paths = [
      getGeneratedPath(job.baseImageUrl),
      getGeneratedPath(job.resultImageUrl),
    ]

    for (const generatedPath of paths) {
      if (generatedPath) {
        generatedPaths.add(generatedPath)
      }
    }
  }

  return generatedPaths
}

async function deleteGeneratedFile(generatedPath: string) {
  const filePath = getGeneratedFilePath(generatedPath)
  const fileStat = await stat(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null
    }

    throw error
  })
  const size = fileStat?.isFile() ? fileStat.size : 0

  if (fileStat?.isFile()) {
    await rm(filePath, { force: true })
  }

  return size
}

export async function cleanupTenantCompositionStorage(tenantSlug: string): Promise<CompositionStorageCleanupResult> {
  const purgeResult = await purgeTenantCompositionJobs(tenantSlug)

  if (!purgeResult.purged) {
    return {
      ok: false,
      deletedJobs: 0,
      deletedFiles: 0,
      deletedGeneratedAssets: 0,
      freedBytes: 0,
      failedFiles: [],
      processingJobs: purgeResult.processingJobs.map((job) => ({
        id: job.id,
        contactName: job.contactName,
      })),
    }
  }

  const generatedPaths = new Set([
    ...collectReferencedGeneratedPaths(purgeResult.jobs),
    ...await collectExistingJobFiles(purgeResult.jobs),
  ])
  const failedFiles: CompositionStorageCleanupResult["failedFiles"] = []
  let deletedFiles = 0
  let deletedGeneratedAssets = 0
  let freedBytes = 0

  for (const generatedPath of generatedPaths) {
    try {
      const fileSize = await deleteGeneratedFile(generatedPath)
      freedBytes += fileSize
      if (fileSize > 0) {
        deletedFiles += 1
      }
    } catch (error) {
      failedFiles.push({
        path: generatedPath,
        error: error instanceof Error ? error.message : "Falha ao apagar arquivo.",
      })
    }

    try {
      if (await deleteGeneratedAsset(generatedPath)) {
        deletedGeneratedAssets += 1
      }
    } catch (error) {
      failedFiles.push({
        path: generatedPath,
        error: error instanceof Error ? error.message : "Falha ao apagar asset persistido.",
      })
    }
  }

  return {
    ok: failedFiles.length === 0,
    deletedJobs: purgeResult.jobs.length,
    deletedFiles,
    deletedGeneratedAssets,
    freedBytes,
    failedFiles,
    processingJobs: [],
  }
}
