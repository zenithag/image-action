export type StudioImageSlot = "base" | "reference"

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
  referenceImage?: StudioImageArtifact
  references?: StudioImageArtifact[]
  instruction?: string
  strength?: number
  updatedAt?: string
}

export function getStudioDraftStorageKey(tenantSlug: string) {
  return `comofica:studio-draft:${tenantSlug}`
}
