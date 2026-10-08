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
  { id: "flooring", label: "Piso / revestimento" },
  { id: "ceiling", label: "Teto" },
]
export function isStudioMaterialPreset(id: StudioPresetId): id is StudioMaterialPresetId { return ["fresh-paint", "wall-covering", "flooring", "ceiling"].includes(id) }

export function toggleStudioPreset(base: StudioImageArtifact, id: StudioPresetId): StudioImageArtifact {
  const selected = new Set(base.presetIds ?? [])
  if (selected.has(id)) selected.delete(id)
  else {
    selected.add(id)
    if (!base.combinePresets && id === "furnish") selected.delete("remove-furniture")
    if (!base.combinePresets && id === "remove-furniture") selected.delete("furnish")
    if (!base.combinePresets && id === "fresh-paint") selected.delete("wall-covering")
    if (!base.combinePresets && id === "wall-covering") selected.delete("fresh-paint")
  }
  return { ...base, presetIds: STUDIO_PRESETS.filter(preset => selected.has(preset.id)).map(preset => preset.id) }
}

// The marker survives the existing job prompt storage; no job schema migration is needed.
export function hasStudioPresetInstruction(prompt: string) {
  const ids = /^PRESETS_ESTUDIO: ([a-z,-]+)\n/.exec(prompt)?.[1].split(",")
  return Boolean(ids?.length && new Set(ids).size === ids.length && ids.every(id => STUDIO_PRESETS.some(preset => preset.id === id)))
}

export const STUDIO_PRESET_ORDER: StudioPresetId[] = ["remove-furniture", "renovate", "fresh-paint", "wall-covering", "flooring", "ceiling", "furnish"]
const presetNames: Record<StudioPresetId, string> = { "remove-furniture": "Remove furniture", renovate: "Restore interior", "fresh-paint": "Fresh paint", "wall-covering": "Wall covering", flooring: "Floor / wall finish", ceiling: "Ceiling finish", furnish: "Furnish" }
const preservePhoto = "Edit the original photograph in place. Preserve its exact pixel dimensions, aspect ratio and portrait/landscape orientation, camera position, focal length, field of view, perspective, room scale and boundaries. Do not crop, rotate, zoom, stretch, expand the canvas or make the room appear larger. Keep walls, structural columns, beams, ceiling height, doors, windows, stairs and openings in their original positions and dimensions. Make only the selected changes, with realistic materials, lighting, shadows and occlusion."

export function getStudioInstruction(base: StudioImageArtifact, fallbackInstruction: string) {
  const manual = (base.instruction || fallbackInstruction).trim()
  const active = STUDIO_PRESET_ORDER.filter(id => base.presetIds?.includes(id))
  const ids = base.combinePresets ? active : active.filter(id => !(active.includes("furnish") && id === "remove-furniture") && !(active.includes("wall-covering") && id === "fresh-paint"))
  if (!ids.length) return manual
  const contextual = ids.some(id => !["remove-furniture", "renovate"].includes(id))
  const room = ({ "living-room": "living room", bedroom: "bedroom", kitchen: "kitchen", bathroom: "bathroom", Sala: "living room", Quarto: "bedroom", Cozinha: "kitchen", Banheiro: "bathroom", Escritório: "office", "Área externa": "outdoor area", Varanda: "balcony" } as Record<string, string>)[base.roomType || ""] || (base.roomType && base.roomType !== "auto" ? base.roomType : "the room shown in the photograph")
  const property = (base.propertyContexts || []).map(value => ({ Apartamento: "apartment", Casa: "house", "Alto padrão": "high-end", Pequeno: "small", Grande: "large", Conjugado: "studio apartment" } as Record<string, string>)[value] || value)
  if (contextual && (room.length > 80 || (base.sceneDescription?.length ?? 0) > 1000 || (base.propertyContexts?.length ?? 0) > 30 || base.propertyContexts?.some(value => typeof value !== "string" || value.length > 80))) throw new Error("Contexto do ambiente inválido ou muito extenso.")
  const directions: Record<StudioPresetId, string> = {
    "remove-furniture": base.removeFixedFurniture
      ? "Remove loose furniture and nonstructural built-in or attached furnishings: sofas, beds, tables, chairs, freestanding and fitted cabinets, wardrobes, shelves, rugs, appliances and decorative objects, including small pots, potted plants and ornaments on windowsills, shelves and counters. Remove their object-dependent shadows/reflections; keep windows, sills, radiators and fixed outdoor vegetation. Also remove visible loose outdoor objects obstructing the view through glass doors/windows; keep glazing, reflections and exterior structures. Reconstruct exposed areas from visible surroundings, not an invented landscape. Remove sinks, toilets or barbecue units only when they are detachable fittings, not masonry or structural components. Keep architectural elements even if they resemble furniture: masonry counters, structural or masonry-integrated countertops, half-walls, pillars, stairs and built-in masonry benches. Never demolish architecture; when uncertain, preserve the element. Reconstruct only the newly exposed wall/floor surfaces from adjacent materials, without changing room geometry. Do not add replacement objects."
      : "Remove loose furniture and movable furnishings only: sofas, beds, tables, chairs, freestanding cabinets and shelves, rugs and decorative objects, including small pots, potted plants and ornaments on windowsills, shelves and counters. Remove their object-dependent shadows/reflections; keep windows, sills, radiators and fixed outdoor vegetation. Also remove visible loose outdoor objects obstructing the view through glass doors/windows; keep glazing, reflections and exterior structures. Reconstruct exposed areas from visible surroundings, not an invented landscape. Preserve attached or built-in furniture, counters, sinks, toilets, barbecue installations and all architectural elements. Reconstruct only surfaces exposed by removed objects using adjacent floor/wall materials, texture and perspective. Do not change the room geometry or add replacement objects.",
    renovate: "Restore the interior to a clean, newly completed and freshly finished condition, preserving its existing design. Repair peeling paint, superficial plaster damage, visible cracks, grime, mold marks, water stains and damp patches on walls and ceilings; remove soot and discoloration and repair visible signs of water infiltration. Renew already painted surfaces in their existing colors unless another preset changes them. Clean and repair floors and retained fixtures, preserving their material, pattern, color and shape. Clean dirty glazing for a clearer view, retaining the actual exterior scene, glass, frames and reflections. Keep layout and remaining furnishings; add/remove nothing or replace intact materials unless another selected preset requests it.",
    "fresh-paint": `Apply fresh, evenly finished paint to already painted walls${base.paintCeiling ? " and the already painted ceiling" : " only"}${base.presetOptions?.["fresh-paint"]?.color ? `, using color ${base.presetOptions["fresh-paint"]!.color}` : ", retaining the existing paint color unless the supplied reference specifies another"}. ${base.paintCeiling ? "" : "During this step, preserve the ceiling. "}Preserve subtle surface texture, shading and edges. Do not paint tile, stone, glass, natural wood, furniture, doors, windows or light fixtures; do not replace wall coverings.`,
    "wall-covering": "Apply the chosen wall covering to wall finish surfaces only. Follow its reference material, color, pattern and realistic scale; if none is supplied, choose a finish appropriate to the room. Align seams and pattern with wall perspective and continue naturally around corners. Preserve openings, trim, furniture, floor, ceiling and wall geometry.",
    flooring: `Replace the finish only on ${base.presetOptions?.flooring?.surface === "walls" ? "the walls; preserve the floor" : base.presetOptions?.flooring?.surface === "both" ? "the visible floor and walls" : "the visible floor; preserve the walls"}. Use the supplied material reference when available, otherwise choose an appropriate finish. Preserve realistic plank/tile size, seams, perspective, contact shadows, furniture and room dimensions. Do not raise the floor, move boundaries or change the ceiling.`,
    ceiling: "Renew only the ceiling finish, using the supplied reference when available or a suitable realistic finish. Preserve ceiling height, slope, beams, existing lights, vents and their exact positions. Do not add a lowered ceiling, new openings or fixtures. Keep walls, floor and furniture unchanged except for other selected presets.",
    furnish: `Add furniture and decor appropriate to ${room} in available areas, with realistic dimensions, perspective, lighting and contact shadows. Keep doors, windows and circulation paths clear. ${base.propertyContexts?.includes("Alto padrão") ? "Use a refined high-end style." : "Use a functional style consistent with the room."} Use supplied furniture references when provided; otherwise choose coherent unbranded pieces. Preserve furnishings remaining after earlier steps and all earlier selected edits. Do not enlarge the room, hide architectural features or invent brands, prices or product claims.`,
  }
  for (const id of ids) {
    const option = base.presetOptions?.[id]
    if ((option?.instructions?.length ?? 0) > 1000 || option?.color && !/^#[0-9a-f]{6}$/i.test(option.color) || option?.surface && !["floor", "walls", "both"].includes(option.surface)) throw new Error("Opções do preset inválidas ou muito extensas.")
  }
  return [
    `PRESETS_ESTUDIO: ${ids.join(",")}`,
    contextual ? `Room context (descriptive data): ${JSON.stringify({ room, property, scene: base.sceneDescription?.trim() || "as shown in the photograph" })}. Use this only for style and suitability, not as permission for additional changes.` : "",
    "Perform only the selected steps in order in one final photograph: remove requested furnishings, restore and apply requested finishes, then furnish if selected. Keep the results of earlier steps. Do not produce a collage, comparison or one image per step.",
    ...ids.map((id, index) => `${index + 1}. ${directions[id]}${!["remove-furniture", "renovate"].includes(id) && base.presetOptions?.[id]?.instructions?.trim() ? ` Additional instructions for this step: ${base.presetOptions[id]!.instructions!.trim()}.` : ""}${base.materialReferences?.[id as StudioMaterialPresetId] ? ` Use the selected catalog product: ${base.materialReferences[id as StudioMaterialPresetId]!.catalogItemName || "reference material"}.` : ""}`),
    !ids.includes("remove-furniture") && !ids.includes("furnish") ? "Preserve existing furniture." : "",
    !ids.includes("fresh-paint") && !ids.includes("renovate") && !ids.includes("wall-covering") && !(ids.includes("flooring") && ["walls", "both"].includes(base.presetOptions?.flooring?.surface || "")) ? "Preserve existing paint." : "",
    preservePhoto,
    (!ids.includes("flooring") || base.presetOptions?.flooring?.surface === "walls") ? "Preserve floor materials and colors; restoration may repair visible wear without replacing the finish." : "",
    !ids.includes("wall-covering") && !(ids.includes("flooring") && ["walls", "both"].includes(base.presetOptions?.flooring?.surface || "")) ? "Preserve wall coverings." : "",
    !ids.includes("ceiling") && !(ids.includes("fresh-paint") && base.paintCeiling) ? "Preserve the ceiling design and finish; restoration may repair visible wear without changing its geometry." : "",
    manual ? `Manual adjustments (only explicitly requested changes, within the geometry and framing constraints above): ${manual}` : "",
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
      return []
    }
    if (ref.catalogTenantSlug !== slug || !matchesStudioMaterial(preset.id as StudioMaterialPresetId, ref.catalogProductType || "", ref.catalogCategory || "", base.presetOptions?.flooring?.surface)) throw new Error("Material salvo incompatível com o tenant ou a superfície. Escolha novamente no catálogo.")
    return [{ ...ref, materialPreset: preset.id as StudioMaterialPresetId, materialSurface: preset.id === "flooring" ? base.presetOptions?.flooring?.surface || "floor" : undefined }]
  })
  references = [...references, ...materialRefs.filter(ref => !references.some(other => ref.catalogItemId ? other.catalogItemId === ref.catalogItemId : other.mediaUrl === ref.mediaUrl))]
  const composedInstruction = getStudioInstruction(base, instruction)
  if (!base.mediaUrl || !composedInstruction) throw new Error("Adicione um ambiente e descreva a transformação.")
  if (references.length > MAX_REFERENCES) throw new Error("Use no máximo 5 referências.")
  if ((base.instruction || instruction).trim().length > 4000) throw new Error("A instrução deve ter até 4.000 caracteres.")
  const prompt = [
    composedInstruction,
    hasStudioPresetInstruction(composedInstruction) ? "" : "Preserve original pixel dimensions, aspect ratio, portrait/landscape orientation, camera, perspective, room size and architecture. Do not crop, zoom, expand canvas or alter unrequested areas.",
    references.length ? "Use the supplied references in order. Each preset reference applies only to its named step; preserve the original photograph geometry and framing." : "",
    ...references.map((ref, index) => ref.source === "catalog"
      ? `Reference ${index + 1}: ${ref.catalogItemName || "product"}. SKU: ${ref.catalogSku || "not provided"}. ${ref.catalogDescription || ""}`.slice(0, 150)
      : `Reference ${index + 1}: ${ref.caption || "uploaded image"}.`.slice(0, 150)),
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
      materialPreset: ref.materialPreset,
      materialSurface: ref.materialSurface,
    })),
    prompt,
  }
}

export function getStudioPaintPreviewSource(item: CatalogItem, slug: string) {
  if (item.tenantSlug !== slug) return undefined
  const source = getCatalogReferenceImageUrl(item)
  if (!source) return undefined
  return `/api/tenant/${encodeURIComponent(slug)}/catalog/items/${encodeURIComponent(item.id)}/image?width=160&v=${encodeURIComponent(item.updatedAt)}`
}

export function getStudioPaintSwatch(item: CatalogItem) {
  return extractColorValuesFromCatalogItem(item).find(color => color.startsWith("#") || color.startsWith("rgb"))
}

export function getStudioPaints(items: CatalogItem[], slug: string) {
  return items.filter(item => item.tenantSlug === slug && item.status === "active" && item.tags?.product_type === "tinta")
}

function normalizeCategory(value: string) { return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim() }
export function matchesStudioMaterial(preset: StudioMaterialPresetId, type: string, category: string, surface: "floor" | "walls" | "both" = "floor") {
  if (preset === "fresh-paint") return type === "tinta"
  const value = normalizeCategory(category)
  if (preset === "wall-covering") return type === "revestimento" && ["revestimentos para parede", "revestimentos de parede"].includes(value)
  if (preset === "flooring") {
    const floor = ["piso", "pisos", "revestimentos para piso", "porcelanatos para piso", "pisos e porcelanatos"].includes(value)
    const walls = ["revestimentos para parede", "revestimentos de parede"].includes(value)
    const both = ["revestimentos para piso e parede", "pisos e paredes"].includes(value)
    return type === "revestimento" && (both || (surface === "floor" ? floor : surface === "walls" ? walls : false))
  }
  return ["revestimento", "outro"].includes(type) && ["forro", "forros", "forros e tetos", "revestimentos para teto"].includes(value)
}
export function getStudioMaterials(items: CatalogItem[], slug: string, preset: StudioMaterialPresetId, surface: "floor" | "walls" | "both" = "floor") {
  return items.filter(item => item.tenantSlug === slug && item.status === "active" && item.tags?.usage_mode !== "referencia" && matchesStudioMaterial(preset, item.tags?.product_type || "", item.category, surface))
}
export function selectStudioMaterial(slug: string, base: StudioImageArtifact, preset: StudioMaterialPresetId, item: CatalogItem): StudioImageArtifact {
  if (!getStudioMaterials([item], slug, preset, base.presetOptions?.flooring?.surface).length) throw new Error("Escolha um material ativo e compatível deste catálogo.")
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
  if (!options.item && !options.furniture?.length) return buildStudioPresetsInput(slug, base, [preset], options)
  const manualTarget = options.placement?.trim() || ""
  if (manualTarget.length > 500) throw new Error("A descrição do local deve ter até 500 caracteres.")
  const source = options.aggregate === false ? { ...base, selectedPresetVersionId: undefined } : base
  const working = { ...getStudioWorkingBase(source), presetIds: [preset], removeFixedFurniture: preset === "remove-furniture" && options.removeFixedFurniture === true, paintCeiling: options.includeCeiling === true, materialReferences: {}, instruction: "", selectedSurfaceIds: [] } as StudioImageArtifact
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
  const scope = manualTarget && isStudioMaterialPreset(preset) ? `Manually specified target: ${manualTarget}. Apply the selected material only in this area. Preserve doors, windows, lights, furniture, objects and architecture. ${preset === "fresh-paint" ? options.includeCeiling ? "Include the already painted ceiling in the fresh-paint step." : "During the fresh-paint step, preserve the ceiling; do not paint it." : "Change only the requested finish."}` : preset === "fresh-paint" ? (options.includeCeiling ? "Paint all already painted walls and the already painted ceiling. Do not replace wall coverings." : "Paint all already painted walls. During this step, keep the ceiling exactly as it is.")
    : preset === "wall-covering" ? "Apply the covering to all walls, preserving ceiling, floor, doors, windows and objects."
    : preset === "flooring" ? `Apply the finish to ${base.presetOptions?.flooring?.surface === "walls" ? "walls only, preserving the floor" : base.presetOptions?.flooring?.surface === "both" ? "the visible floor and walls" : "the visible floor only, preserving walls"}; preserve ceiling and objects.` : preset === "ceiling" ? "Apply the ceiling finish throughout, preserving lights, walls, floor and objects."
    : preset === "renovate" ? "Restore paint and visible wear on walls, ceilings and retained fixed objects. Preserve architecture and existing materials."
    : preset === "furnish" ? `Add only the catalog items supplied as references. Preserve all existing furnishings and earlier edits. ${options.placement?.trim() ? `Requested placement: ${options.placement.trim()}.` : "Use available areas and keep circulation paths clear."}` : options.removeFixedFurniture && preset === "remove-furniture" ? "Remove the requested detachable fixed furnishings; preserve paint, finishes, floor, ceiling and architecture. Do not add objects." : "Preserve paint, wall coverings, floor, ceiling and fixed elements."
  input.prompt = `${input.prompt}\n${scope}`
  if ((input.prompt?.length ?? 0) > 5000) throw new Error("Instrução final muito extensa.")
  return { ...input, purpose: "studio-preset", presetIds: [preset], baseMessageId: working.source === "inbox" ? working.messageId : undefined }
}


// Removing a completed draft version does not delete shared job files or other versions.
export function buildStudioPresetsInput(slug: string, base: StudioImageArtifact, presets: StudioPresetId[], options: {
  strength: number; includeCeiling?: boolean; removeFixedFurniture?: boolean; aggregate?: boolean; placement?: string;
  materials?: Partial<Record<StudioMaterialPresetId, CatalogItem>>; furniture?: CatalogItem[]
}): CompositionJobInput {
  if (!presets.length || presets.length > STUDIO_PRESET_ORDER.length || presets.some(id => !STUDIO_PRESET_ORDER.includes(id)) || new Set(presets).size !== presets.length) throw new Error("Selecione presets válidos, sem repetições.")
  if ((options.placement?.length ?? 0) > 500) throw new Error("A descrição do local deve ter até 500 caracteres.")
  const ids = STUDIO_PRESET_ORDER.filter(id => presets.includes(id))
  let working: StudioImageArtifact = { ...getStudioWorkingBase(options.aggregate === false ? { ...base, selectedPresetVersionId: undefined } : base), presetIds: ids, combinePresets: true, materialReferences: {}, instruction: "", selectedSurfaceIds: [], paintCeiling: options.includeCeiling === true, removeFixedFurniture: ids.includes("remove-furniture") && options.removeFixedFurniture === true }
  for (const id of ids.filter(isStudioMaterialPreset)) {
    const item = options.materials?.[id]
    if (item) working = selectStudioMaterial(slug, working, id, item)
  }
  const furniture = ids.includes("furnish") ? options.furniture || [] : []
  if (furniture.some(item => !getStudioFurniture([item], slug).length)) throw new Error("Escolha móveis ativos deste catálogo.")
  const uploaded = ids.filter(id => !["remove-furniture", "renovate"].includes(id)).flatMap(id => {
    const reference = base.presetOptions?.[id]?.reference
    if (!reference) return []
    if (reference.source !== "upload" || !/^data:image\/(jpeg|png|webp);base64,/.test(reference.mediaUrl)) throw new Error("Referência de imagem inválida. Envie uma imagem JPG, PNG ou WebP.")
    return [{ ...reference, caption: `Reference for the ${presetNames[id]} step` }]
  })
  const refs: StudioImageArtifact[] = [...uploaded, ...furniture.map(item => ({ source: "catalog" as const, mediaUrl: item.imageUrl, catalogItemId: item.id, catalogItemName: item.name, catalogSku: item.sku, createdAt: item.createdAt }))]
  const input = buildStudioInput(slug, working, refs, "")
  input.prompt += [
    ids.includes("fresh-paint") ? options.includeCeiling ? "Include the already painted ceiling in the fresh-paint step." : "During the fresh-paint step, preserve the ceiling; do not paint it." : "",
    furniture.length ? "During the furnishing step, use only the catalog furniture supplied as references and preserve earlier edits." : "",
    options.placement?.trim() ? `Manually specified target: ${options.placement.trim()}.` : "",
  ].filter(Boolean).map(line => `\n${line}`).join("")
  if ((input.prompt?.length ?? 0) > 5000) throw new Error("Contexto final muito extenso. Reduza as descrições e instruções adicionais.")
  return { ...input, purpose: "studio-preset", presetIds: ids, changeStrength: options.strength }
}

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
