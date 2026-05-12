import type { CompositionJob } from "@/lib/composition-types"

export function getInboxBaseImageUrl(job: CompositionJob) {
  if (!job.baseMessageId || !job.conversationId || !job.tenantSlug) {
    return undefined
  }

  return `/api/tenant/${encodeURIComponent(job.tenantSlug)}/inbox/conversations/${encodeURIComponent(job.conversationId)}/messages/${encodeURIComponent(job.baseMessageId)}/media`
}

export function getCompositionBaseImageUrl(job: CompositionJob) {
  return job.baseImageUrl || getInboxBaseImageUrl(job)
}

export function getCompositionThumbnailUrl(job: CompositionJob, options?: { width?: number }) {
  const imageKind = job.resultImageUrl ? "result" : "base"
  const width = options?.width ?? 768
  const version = imageKind === "result"
    ? job.completedAt || job.updatedAt || job.resultImageUrl
    : job.baseImageUrl || job.baseMessageId || job.updatedAt || job.createdAt

  const url = `/api/tenant/${encodeURIComponent(job.tenantSlug)}/compositions/jobs/${encodeURIComponent(job.id)}/thumbnail?image=${imageKind}&w=${encodeURIComponent(String(width))}`

  return imageUrlWithVersion(url, version)
}

export function imageUrlWithVersion(url: string | undefined, version: string | undefined) {
  if (!url || !version || url.startsWith("data:")) return url

  const separator = url.includes("?") ? "&" : "?"

  return `${url}${separator}v=${encodeURIComponent(version)}`
}
