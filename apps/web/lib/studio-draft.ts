import type { SurfaceAnalysis } from "./studio-surfaces"

export type StudioImageSlot = "base" | "reference"

export type StudioCompositionStrategy = "matrix" | "bundle"

export type StudioMaterialPresetId = "fresh-paint" | "wall-covering" | "flooring" | "ceiling"
export type StudioPresetId = "remove-furniture" | "renovate" | "furnish" | StudioMaterialPresetId

export type StudioPresetVersion = {
  jobId: string
  preset: StudioPresetId
  label: string
  parentVersionId?: string
  selectedSurfaceIds?: string[]
  scope?: "whole" | "selected"
  manualTarget?: string
  resultImageUrl?: string
  status: "queued" | "processing" | "done" | "failed"
  createdAt: string
  /** True once the image was saved into Compositions. */
  savedAsComposition?: boolean
}

export type StudioImageArtifact = {
  presetVersions?: StudioPresetVersion[]
  selectedPresetVersionId?: string
  pendingPresetLabel?: string
  pendingPresetId?: StudioPresetId
  pendingParentVersionId?: string

  surfaceAnalysis?: SurfaceAnalysis & { sourceKey: string; tenantSlug: string; sourceVersionId?: string }
  selectedSurfaceSourceKey?: string
  selectedSurfaceIds?: string[]
  surfaceMaterialId?: string
  roomType?: "auto" | "living-room" | "bedroom" | "kitchen" | "bathroom"
  removeFixedFurniture?: boolean
  furnishingLuxury?: boolean
  materialReferences?: Partial<Record<StudioMaterialPresetId, StudioImageArtifact>>
  materialJobPresetId?: StudioMaterialPresetId
  catalogTenantSlug?: string
  catalogProductType?: string
  presetIds?: StudioPresetId[]
  paintCatalogItemId?: string
  paintJobId?: string
  selectedReferenceUrls?: string[]
  instruction?: string
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

export type StudioScenario = {
  baseKey: string
  selectedReferenceUrls?: string[]
  instruction?: string
}

// Slots survive quantity reductions; changing a base never replaces a slot's inputs.
export function ensureStudioScenarios(scenarios: StudioScenario[], bases: StudioImageArtifact[]): StudioScenario[] {
  if (scenarios.length >= bases.length) return scenarios
  return [...scenarios, ...bases.slice(scenarios.length).map(base => ({
    baseKey: getStudioArtifactKey(base), selectedReferenceUrls: base.selectedReferenceUrls ? [...base.selectedReferenceUrls] : undefined,
    instruction: base.instruction || "",
  }))]
}

export function planStudioScenarios(scenarios: StudioScenario[], bases: StudioImageArtifact[], references: StudioImageArtifact[]) {
  return ensureStudioScenarios(scenarios, bases).slice(0, bases.length).map((scenario, index) => {
    const baseIndex = bases.findIndex(base => getStudioArtifactKey(base) === scenario.baseKey)
    const source = bases[baseIndex]
    const selected = scenario.selectedReferenceUrls === undefined ? references : references.filter(ref => scenario.selectedReferenceUrls!.includes(ref.mediaUrl))
    return { id: `scenario:${index}`, baseIndex, base: source ? { ...source, instruction: scenario.instruction || "", selectedReferenceUrls: scenario.selectedReferenceUrls } : null,
      references: selected, label: `Cenário ${index + 1} · ${source ? `Ambiente ${baseIndex + 1}` : "Escolha um ambiente"} + ${selected.length} referência(s) → 1 composição` }
  })
}

export type StudioDraft = {
  baseImage?: StudioImageArtifact
  baseImages?: StudioImageArtifact[]
  referenceImage?: StudioImageArtifact
  references?: StudioImageArtifact[]
  generationStrategy?: StudioCompositionStrategy
  targetOutputCount?: number
  scenarios?: StudioScenario[]
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
  if (artifact.source === "upload") return `upload:${artifact.mediaUrl}`
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
