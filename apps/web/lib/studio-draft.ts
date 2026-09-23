export type StudioImageSlot = "base" | "reference"

export type StudioCompositionStrategy = "matrix" | "bundle"

export type StudioImageArtifact = {
  source: "inbox" | "catalog" | "upload"
  conversationId?: string
  channelInstanceId?: string
  messageId?: string
  mediaUrl: string
  caption?: string
  contactName?: string
  contactPhone?: string
  catalogItemId?: string
  catalogItemName?: string
  catalogSku?: string
  catalogCategory?: string
  catalogDescription?: string
  createdAt: string
}

export type StudioDraft = {
  baseImage?: StudioImageArtifact
  baseImages?: StudioImageArtifact[]
  referenceImage?: StudioImageArtifact
  references?: StudioImageArtifact[]
  generationStrategy?: StudioCompositionStrategy
  targetOutputCount?: number
  instruction?: string
  strength?: number
  updatedAt?: string
}

export function getStudioDraftStorageKey(tenantSlug: string) {
  return `comofica:studio-draft:${tenantSlug}`
}

export function getStudioArtifactKey(artifact: StudioImageArtifact): string {
  if (artifact.source === "catalog" && artifact.catalogItemId) return `catalog:${artifact.catalogItemId}`
  if (artifact.source === "catalog" && artifact.catalogSku) return `catalog-sku:${artifact.catalogSku.toLowerCase()}`
  if (artifact.source === "inbox" && artifact.messageId) return `inbox:${artifact.messageId}`
  if (artifact.source === "upload") return `upload:${artifact.mediaUrl.slice(0, 80)}`
  return `${artifact.source}:${artifact.mediaUrl}`
}

export function addStudioBaseImage(
  draft: StudioDraft,
  artifact?: StudioImageArtifact
): StudioImageArtifact[] {
  if (!artifact) return draft.baseImages ?? (draft.baseImage ? [draft.baseImage] : [])

  const currentBases = draft.baseImages ?? (draft.baseImage ? [draft.baseImage] : [])
  const key = getStudioArtifactKey(artifact)
  const exists = currentBases.some((item) => getStudioArtifactKey(item) === key)

  return exists ? currentBases : [...currentBases, artifact]
}

export function addStudioReference(
  draft: StudioDraft,
  artifact?: StudioImageArtifact
): StudioImageArtifact[] {
  if (!artifact) return draft.references ?? (draft.referenceImage ? [draft.referenceImage] : [])

  const currentReferences = draft.references ?? (draft.referenceImage ? [draft.referenceImage] : [])
  const key = getStudioArtifactKey(artifact)
  const exists = currentReferences.some((item) => getStudioArtifactKey(item) === key)

  return exists ? currentReferences : [...currentReferences, artifact]
}
