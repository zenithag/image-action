import { getCatalogReferenceImageUrl } from "./server/catalog-reference-image"
import { extractColorValuesFromCatalogItem } from "./server/catalog-color-utils"
import type { CatalogItem } from "./catalog-types"
import type { CompositionJob, CompositionJobInput } from "./composition-types"
import type { StudioImageArtifact, StudioPresetId, StudioMaterialPresetId } from "./studio-draft"

export const MAX_REFERENCES = 5
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const MAX_REQUEST_BYTES = 9_500_000
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

export const STUDIO_PRESETS: { id: StudioPresetId; label: string }[] = [
  { id: "remove-furniture", label: "Remover móveis" },
  { id: "fresh-paint", label: "Pintura nova" },
  { id: "renovate", label: "Renovar ambiente" },
  { id: "furnish", label: "Mobiliar" },
  { id: "wall-covering", label: "Revestimento para parede" },
  { id: "flooring", label: "Piso / porcelanato" },
  { id: "ceiling", label: "Forro / teto" },
]
export function isStudioMaterialPreset(id: StudioPresetId): id is StudioMaterialPresetId { return ["fresh-paint", "wall-covering", "flooring", "ceiling"].includes(id) }

export function toggleStudioPreset(base: StudioImageArtifact, id: StudioPresetId): StudioImageArtifact {
  const selected = new Set(base.presetIds ?? [])
  if (selected.has(id)) selected.delete(id)
  else {
    selected.add(id)
    if (id === "furnish") selected.delete("remove-furniture")
    if (id === "remove-furniture") selected.delete("furnish")
    if (id === "fresh-paint") selected.delete("wall-covering")
    if (id === "wall-covering") selected.delete("fresh-paint")
  }
  return { ...base, presetIds: STUDIO_PRESETS.filter(preset => selected.has(preset.id)).map(preset => preset.id) }
}

// The marker survives the existing job prompt storage; no job schema migration is needed.
export function hasStudioPresetInstruction(prompt: string) {
  const ids = /^PRESETS_ESTUDIO: ([a-z,-]+)\n/.exec(prompt)?.[1].split(",")
  return Boolean(ids?.length && new Set(ids).size === ids.length && ids.every(id => STUDIO_PRESETS.some(preset => preset.id === id)))
}

export function getStudioInstruction(base: StudioImageArtifact, fallbackInstruction: string) {
  const manual = (base.instruction || fallbackInstruction).trim()
  const active = STUDIO_PRESETS.filter(preset => base.presetIds?.includes(preset.id)).map(preset => preset.id)
  // Old/malformed drafts with conflicting IDs resolve to furnishing, never both directives.
  const furnish = active.includes("furnish")
  const removeFurniture = !furnish && active.includes("remove-furniture")
  const ids = active.filter(id => !(furnish && id === "remove-furniture") && !(active.includes("wall-covering") && id === "fresh-paint"))
  if (!ids.length) return manual
  const freshPaint = ids.includes("fresh-paint"), renovate = ids.includes("renovate")
  const room = base.roomType === "living-room" ? "sala de estar" : base.roomType === "bedroom" ? "quarto" : base.roomType === "kitchen" ? "cozinha" : base.roomType === "bathroom" ? "banheiro" : "tipo de cômodo visível, sem presumir uma função que a imagem não sustenta"
  return [
    `PRESETS_ESTUDIO: ${ids.join(",")}`,
    removeFurniture ? base.removeFixedFurniture ? "Remova móveis soltos e também móveis e instalações fixas, incluindo pias, armários embutidos, vasos sanitários e churrasqueira. Deixe somente paredes, piso e teto; preserve a estrutura, portas, janelas e aberturas, sem demolir arquitetura." : "Remova apenas móveis soltos. Preserve elementos fixos, armários embutidos e churrasqueira."
      : furnish ? `Adicione mobília adequada para ${room}, nas áreas livres, respeitando circulação, proporções e escala. Preserve elementos fixos e não altere arquitetura. ${base.furnishingLuxury ? "Use uma composição visual de alto padrão, sem inventar marcas, preços ou propriedades comerciais." : "Use uma composição funcional e coerente com o ambiente."}` : "Preserve os móveis existentes.",
    renovate ? "Renove a aparência do ambiente e repare visualmente desgaste e pintura. Preserve os materiais existentes, sem alterações estruturais, remoção de móveis ou adição de mobília implícitas; outros presets explícitos podem autorizar essas mudanças." : "",
    freshPaint ? "Renove apenas a pintura das superfícies já pintadas, mantendo a cor salvo ajuste manual ou tinta de catálogo escolhida." : renovate ? "Renove a pintura existente sem trocar revestimentos." : "Preserve a pintura existente.",
    ...ids.filter(isStudioMaterialPreset).filter(id => base.materialReferences?.[id]).map(id => {
      const material = base.materialReferences![id]!
      const target = id === "fresh-paint" ? "superfícies já pintadas" : id === "wall-covering" ? "revestimento das paredes" : id === "flooring" ? "piso visível" : "acabamento do teto / forro"
      return `${id === "fresh-paint" ? "Pintura escolhida" : `Material escolhido para ${target}`}: ${material.catalogItemName || "produto do catálogo"}. ${id === "fresh-paint" ? "Aplique a cor e aparência da tinta." : "Use a referência do catálogo para o acabamento solicitado, sem alterar estrutura."} Isto é uma instrução semântica geral, não uma máscara de pixels.`
    }),
    !ids.some(id => id === "wall-covering" || id === "flooring" || id === "ceiling")
      ? "Preserve câmera, perspectiva, arquitetura, paredes, piso, revestimentos e estrutura. Não altere partes não solicitadas."
      : `Preserve câmera, perspectiva, arquitetura e estrutura. ${ids.includes("wall-covering") ? "Altere apenas o acabamento de parede solicitado." : "Preserve revestimentos de parede."} ${ids.includes("flooring") ? "Altere apenas o acabamento do piso solicitado." : "Preserve piso."} ${ids.includes("ceiling") ? "Altere apenas o acabamento do teto solicitado." : "Preserve teto."} Preserve portas, janelas, móveis e luminárias salvo outro preset explícito.`,
    manual ? `Ajustes manuais (prioridade apenas nos pontos explicitamente solicitados): ${manual}` : "",
  ].filter(Boolean).join("\n")
}

export function getEnvironmentReferences(base: StudioImageArtifact, references: StudioImageArtifact[]) {
  return base.selectedReferenceUrls === undefined ? references : references.filter(reference => base.selectedReferenceUrls!.includes(reference.mediaUrl))
}

export function validateStudioFiles(files: Pick<File, "type" | "size">[], currentCount: number, slot: "base" | "reference") {
  if (slot === "base" && files.length !== 1) return "Selecione apenas uma foto do ambiente."
  if (slot === "reference" && currentCount + files.length > MAX_REFERENCES) return "Você pode adicionar até 5 referências. Remova uma para continuar."
  if (files.some(file => !IMAGE_TYPES.includes(file.type))) return "Use imagens JPG, PNG ou WebP."
  if (files.some(file => file.size > MAX_UPLOAD_BYTES)) return "Cada imagem deve ter no máximo 15 MB."
  return null
}

export function buildStudioInput(slug: string, base: StudioImageArtifact, references: StudioImageArtifact[], instruction: string): CompositionJobInput {
  if (base.selectedSurfaceIds?.length) throw new Error("A seleção experimental ainda não restringe a geração. Limpe a seleção para gerar sem máscara.")
  if (references.length > MAX_REFERENCES) throw new Error("Use no máximo 5 referências.")
  const materialRefs = STUDIO_PRESETS.filter(preset => isStudioMaterialPreset(preset.id) && base.presetIds?.includes(preset.id)).flatMap(preset => {
    const ref = base.materialReferences?.[preset.id as StudioMaterialPresetId]
    if (!ref) {
      if (preset.id !== "fresh-paint") throw new Error("Escolha um material compatível no catálogo antes de gerar.")
      return []
    }
    if (ref.catalogTenantSlug !== slug || !matchesStudioMaterial(preset.id as StudioMaterialPresetId, ref.catalogProductType || "", ref.catalogCategory || "")) throw new Error("Material salvo incompatível com o tenant ou a superfície. Escolha novamente no catálogo.")
    return [ref]
  })
  references = [...references, ...materialRefs.filter(ref => !references.some(other => ref.catalogItemId ? other.catalogItemId === ref.catalogItemId : other.mediaUrl === ref.mediaUrl))]
  const composedInstruction = getStudioInstruction(base, instruction)
  if (!base.mediaUrl || !composedInstruction) throw new Error("Adicione um ambiente e descreva a transformação.")
  if (references.length > MAX_REFERENCES) throw new Error("Use no máximo 5 referências.")
  if ((base.instruction || instruction).trim().length > 4000) throw new Error("A instrução deve ter até 4.000 caracteres.")
  const prompt = [
    composedInstruction,
    "Preserve a câmera, a perspectiva e a arquitetura do ambiente.",
    references.length ? "Aplique as referências em conjunto, na ordem enviada, seguindo a instrução." : "",
    ...references.map((ref, index) => ref.source === "catalog"
      ? `Referência ${index + 1}: ${ref.catalogItemName || "produto"}. SKU: ${ref.catalogSku || "não informado"}. ${ref.catalogDescription || ""}`.slice(0, 150)
      : `Referência ${index + 1}: ${ref.caption || "imagem enviada"}.`.slice(0, 150)),
  ].filter(Boolean).join("\n")
  if (prompt.length > 5000) throw new Error("A instrução final com presets e referências excede 5.000 caracteres. Reduza o texto manual.")
  return {
    studioVersion: "v1",
    conversationId: base.conversationId || `studio:${slug}`,
    channelInstanceId: base.channelInstanceId || "studio-upload",
    contactName: base.contactName || "Studio",
    contactPhone: base.contactPhone,
    source: "operator",
    mode: "interior",
    baseImageUrl: base.mediaUrl,
    baseMessageId: base.source === "inbox" ? base.messageId : undefined,
    references: references.map(ref => ({
      source: ref.source === "upload" ? "url" : ref.source,
      imageUrl: ref.source !== "catalog" ? ref.mediaUrl : undefined,
      messageId: ref.messageId,
      catalogItemId: ref.catalogItemId,
      catalogItemName: ref.catalogItemName,
      catalogSku: ref.catalogSku,
      catalogCategory: ref.catalogCategory,
      catalogDescription: ref.catalogDescription,
    })),
    prompt,
  }
}

export function getStudioPaintPreviewSource(item: CatalogItem, slug: string) {
  if (item.tenantSlug !== slug) return undefined
  const source = getCatalogReferenceImageUrl(item)
  if (!source) return undefined
  // Use the persisted raster upload like CatalogBrowser; avoid an extra HTTP hop.
  if (source.startsWith("data:")) return source
  return `/api/tenant/${encodeURIComponent(slug)}/catalog/items/${encodeURIComponent(item.id)}/image`
}

export function getStudioPaintSwatch(item: CatalogItem) {
  return extractColorValuesFromCatalogItem(item).find(color => color.startsWith("#") || color.startsWith("rgb"))
}

export function getStudioPaints(items: CatalogItem[], slug: string) {
  return items.filter(item => item.tenantSlug === slug && item.status === "active" && item.tags?.product_type === "tinta")
}

function normalizeCategory(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim() }
export function matchesStudioMaterial(preset: StudioMaterialPresetId, type: string, category: string) {
  if (preset === "fresh-paint") return type === "tinta"
  const value = normalizeCategory(category)
  if (preset === "wall-covering") return type === "revestimento" && ["revestimentos para parede", "revestimentos de parede"].includes(value)
  if (preset === "flooring") return type === "revestimento" && ["piso", "pisos", "revestimentos para piso", "porcelanatos para piso", "pisos e porcelanatos"].includes(value)
  return ["revestimento", "outro"].includes(type) && ["forro", "forros", "forros e tetos", "revestimentos para teto"].includes(value)
}
export function getStudioMaterials(items: CatalogItem[], slug: string, preset: StudioMaterialPresetId) {
  return items.filter(item => item.tenantSlug === slug && item.status === "active" && item.tags?.usage_mode !== "referencia" && matchesStudioMaterial(preset, item.tags?.product_type || "", item.category))
}
export function selectStudioMaterial(slug: string, base: StudioImageArtifact, preset: StudioMaterialPresetId, item: CatalogItem): StudioImageArtifact {
  if (!getStudioMaterials([item], slug, preset).length) throw new Error("Escolha um material ativo e compatível deste catálogo.")
  const selected = base.presetIds?.includes(preset) ? base : toggleStudioPreset(base, preset)
  const reference: StudioImageArtifact = { source: "catalog", mediaUrl: item.imageUrl, catalogItemId: item.id, catalogItemName: item.name, catalogSku: item.sku, catalogCategory: item.category, catalogDescription: item.description, catalogTenantSlug: slug, catalogProductType: item.tags.product_type, createdAt: item.createdAt }
  return { ...selected, materialReferences: { ...base.materialReferences, [preset]: reference }, paintCatalogItemId: preset === "fresh-paint" ? item.id : base.paintCatalogItemId, surfaceMaterialId: base.selectedSurfaceIds?.length ? item.id : base.surfaceMaterialId }
}
export function buildStudioMaterialInput(slug: string, base: StudioImageArtifact, preset: StudioMaterialPresetId, item: CatalogItem, manual: string, strength: number): CompositionJobInput {
  if (base.selectedSurfaceIds?.length) throw new Error("A seleção experimental ainda não restringe a geração. Limpe a seleção para aplicar pintura geral.")
  const selected = selectStudioMaterial(slug, base, preset, item)
  const input = buildStudioInput(slug, selected, [], manual)
  return { ...input, catalogItemId: item.id, catalogItemName: item.name, catalogColorReference: preset === "fresh-paint" ? extractColorValuesFromCatalogItem(item).join("; ") || undefined : undefined, changeStrength: strength }
}
export function buildStudioPaintInput(slug: string, base: StudioImageArtifact, item: CatalogItem, manual: string, strength: number): CompositionJobInput {
  if (!getStudioPaints([item], slug).length) throw new Error("Escolha uma tinta ativa deste catálogo.")
  return buildStudioMaterialInput(slug, base, "fresh-paint", item, manual, strength)
}

export async function submitStudioPaintJob(slug: string, input: CompositionJobInput, request: typeof fetch = fetch): Promise<CompositionJob> {
  const serialized = JSON.stringify(input)
  if (new Blob([serialized]).size > MAX_REQUEST_BYTES) throw new Error("As imagens excedem o limite de envio.")
  const response = await request(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: serialized,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.job) throw new Error(payload?.error || "Não foi possível enviar a pintura. Tente novamente.")
  if (payload.job.tenantSlug !== slug || !payload.job.id) throw new Error("Resposta de composição inválida.")
  return payload.job
}

export async function readStudioPaintJob(slug: string, id: string, signal?: AbortSignal, request: typeof fetch = fetch): Promise<CompositionJob> {
  const response = await request(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs/${encodeURIComponent(id)}`, { cache: "no-store", signal })
  if (!response.ok) throw new Error("Não foi possível atualizar a pintura. Tentaremos novamente.")
  const job = await response.json() as CompositionJob
  if (job.id !== id || job.tenantSlug !== slug) throw new Error("Resposta de composição inválida.")
  return job
}


// Versions keep their original artifact identity; only the worker input uses the chosen raster.
export function getStudioWorkingBase(base: StudioImageArtifact): StudioImageArtifact {
  const chosen = base.presetVersions?.find(version => version.jobId === base.selectedPresetVersionId && version.status === "done" && version.resultImageUrl)
  return chosen ? { ...base, source: "upload", mediaUrl: chosen.resultImageUrl!, messageId: undefined, surfaceAnalysis: undefined, selectedSurfaceIds: [] } : base
}

export function buildStudioCompositionInput(slug: string, base: StudioImageArtifact, references: StudioImageArtifact[], manual: string) {
  // Presets already rendered into the chosen version must not be applied a second time.
  return buildStudioInput(slug, { ...getStudioWorkingBase(base), presetIds: [], materialReferences: {}, selectedSurfaceIds: [] }, references, manual)
}

export function getStudioFurniture(items: CatalogItem[], slug: string) {
  return items.filter(item => item.tenantSlug === slug && item.status === "active" && item.tags?.usage_mode !== "referencia" && ["movel", "decoracao"].includes(item.tags?.product_type) && Boolean(getCatalogReferenceImageUrl(item)))
}

export function chooseStudioFurniture(items: CatalogItem[], slug: string, room: string, random: () => number = Math.random) {
  const compatible = getStudioFurniture(items, slug).filter(item => item.tags.room_type?.split(",").map(value => value.trim()).includes(room))
  const unique = [...new Map(compatible.map(item => [item.id, item])).values()]
  return unique.map(item => ({ item, order: random() })).sort((a, b) => a.order - b.order).slice(0, MAX_REFERENCES).map(entry => entry.item)
}

export function buildStudioPresetInput(slug: string, base: StudioImageArtifact, preset: StudioPresetId, options: {
  item?: CatalogItem; furniture?: CatalogItem[]; includeCeiling?: boolean; removeFixedFurniture?: boolean; scope?: "whole" | "selected";
  aggregate?: boolean; placement?: string; strength: number
}): CompositionJobInput {
  if (options.scope === "selected") throw new Error("A seleção automática de superfícies foi desativada. Descreva o local de aplicação em texto.")
  const manualTarget = options.placement?.trim() || ""
  if (manualTarget.length > 500) throw new Error("A descrição do local deve ter até 500 caracteres.")
  const source = options.aggregate === false ? { ...base, selectedPresetVersionId: undefined } : base
  const working = { ...getStudioWorkingBase(source), presetIds: [preset], removeFixedFurniture: preset === "remove-furniture" && options.removeFixedFurniture === true, materialReferences: {}, instruction: "", selectedSurfaceIds: [] } as StudioImageArtifact
  let input: CompositionJobInput
  if (isStudioMaterialPreset(preset)) {
    if (!options.item) throw new Error("Escolha um material do catálogo.")
    input = buildStudioMaterialInput(slug, working, preset, options.item, "", options.strength)
  } else {
    const furniture = options.furniture || []
    if (preset === "furnish" && !furniture.length) throw new Error("Escolha móveis reais do catálogo antes de aplicar.")
    if (furniture.length > MAX_REFERENCES || furniture.some(item => !getStudioFurniture([item], slug).length)) throw new Error("Escolha até 5 móveis ou objetos ativos deste catálogo.")
    const refs: StudioImageArtifact[] = furniture.map(item => ({ source: "catalog", mediaUrl: item.imageUrl, catalogItemId: item.id, catalogItemName: item.name, catalogSku: item.sku, catalogDescription: item.description, catalogCategory: item.category, createdAt: item.createdAt }))
    input = buildStudioInput(slug, working, refs, "")
    input.changeStrength = options.strength
  }
  const scope = manualTarget && isStudioMaterialPreset(preset) ? `Local de aplicação indicado manualmente: ${manualTarget}. Use esta descrição para identificar onde aplicar o material escolhido; não estenda a alteração às outras partes do ambiente. Preserve portas, janelas, luminárias, móveis, objetos e arquitetura. ${preset === "fresh-paint" ? options.includeCeiling ? "Inclua também o teto pintado." : "Preserve o teto e o forro; não os pinte." : "Altere somente o acabamento solicitado."}` : preset === "fresh-paint" ? (options.includeCeiling ? "Pinte todas as paredes já pintadas e inclua o teto pintado. Não substitua revestimentos." : "Pinte todas as paredes já pintadas. Preserve o teto e o forro exatamente como estão.")
    : preset === "wall-covering" ? "Aplique em todas as paredes, preservando teto, piso, portas, janelas e objetos."
    : preset === "flooring" ? "Aplique em todo o piso visível, preservando paredes, teto e objetos." : preset === "ceiling" ? "Aplique em todo o teto / forro, preservando luminárias, paredes, piso e objetos."
    : preset === "renovate" ? "Restaure apenas a aparência dos materiais existentes: desgaste, trincas, sujeira e manchas no piso, paredes e teto. Mantenha os mesmos materiais, cores, desenho, mobiliário e estrutura; aparência de tudo novo, sem substituições."
    : preset === "furnish" ? `Adicione apenas os itens do catálogo enviados como referências. Preserve todo o mobiliário e todas as edições já presentes na imagem. ${options.placement?.trim() ? `Posição solicitada (orientação semântica, sem garantia espacial): ${options.placement.trim()}.` : "Distribua os itens nas áreas livres respeitando circulação."}` : options.removeFixedFurniture && preset === "remove-furniture" ? "Retire também as instalações fixas solicitadas; preserve pintura, revestimentos, piso, teto e estrutura. Não adicione móveis ou objetos." : "Preserve pintura, revestimentos, piso, teto e elementos fixos."
  input.prompt = `${input.prompt}\n${scope}`
  if (input.prompt.length > 5000) throw new Error("Instrução final muito extensa.")
  return { ...input, purpose: "studio-preset", baseMessageId: working.source === "inbox" ? working.messageId : undefined }
}


// Removing a completed draft version does not delete shared job files or other versions.
export function removeStudioPresetVersion(base: StudioImageArtifact, jobId: string): Partial<StudioImageArtifact> | null {
  if (!base.presetVersions?.some(version => version.jobId === jobId && version.status === "done")) return null
  return {
    presetVersions: base.presetVersions.filter(version => version.jobId !== jobId),
    ...(base.selectedPresetVersionId === jobId ? { selectedPresetVersionId: undefined } : {}),
    ...(base.paintJobId === jobId ? { paintJobId: undefined, pendingPresetId: undefined, pendingPresetLabel: undefined, pendingParentVersionId: undefined } : {}),
  }
}

export function recordStudioPresetResult(base: StudioImageArtifact, job: CompositionJob): Partial<StudioImageArtifact> | null {
  if (base.paintJobId !== job.id) return null
  const previous = base.presetVersions?.find(version => version.jobId === job.id)
  if (previous && previous.status === job.status && previous.resultImageUrl === job.resultImageUrl) return null
  const version = { ...previous, jobId: job.id, preset: previous?.preset || base.pendingPresetId || base.materialJobPresetId || "fresh-paint" as StudioPresetId, label: previous?.label || base.pendingPresetLabel || "Material aplicado", parentVersionId: previous?.parentVersionId || base.pendingParentVersionId, resultImageUrl: job.resultImageUrl, status: job.status, createdAt: job.createdAt }
  return { presetVersions: [...(base.presetVersions || []).filter(value => value.jobId !== job.id), version], ...(job.status === "done" && job.resultImageUrl && previous?.status !== "done" ? { selectedPresetVersionId: job.id } : {}) }
}
