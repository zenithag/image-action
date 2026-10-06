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

export function getStudioInstruction(base: StudioImageArtifact, fallbackInstruction: string) {
  const manual = (base.instruction || fallbackInstruction).trim()
  const active = STUDIO_PRESET_ORDER.filter(id => base.presetIds?.includes(id))
  const ids = base.combinePresets ? active : active.filter(id => !(active.includes("furnish") && id === "remove-furniture") && !(active.includes("wall-covering") && id === "fresh-paint"))
  if (!ids.length) return manual
  const contextual = ids.some(id => !["remove-furniture", "renovate"].includes(id))
  const room = ({ "living-room": "sala de estar", bedroom: "quarto", kitchen: "cozinha", bathroom: "banheiro" } as Record<string, string>)[base.roomType || ""] || (base.roomType && base.roomType !== "auto" ? base.roomType : "tipo de cômodo visível na imagem")
  if (contextual && (room.length > 80 || (base.sceneDescription?.length ?? 0) > 1000 || (base.propertyContexts?.length ?? 0) > 30 || base.propertyContexts?.some(value => typeof value !== "string" || value.length > 80))) throw new Error("Contexto do ambiente inválido ou muito extenso.")
  const directions: Record<StudioPresetId, string> = {
    "remove-furniture": base.removeFixedFurniture
      ? "Remova móveis soltos e também móveis e instalações fixas, incluindo pias, armários embutidos, vasos sanitários e churrasqueira. Deixe somente paredes, piso e teto; preserve a estrutura, portas, janelas e aberturas, sem demolir arquitetura."
      : "Remova apenas móveis soltos. Preserve elementos fixos, armários embutidos e churrasqueira.",
    renovate: `Renove a aparência do ambiente para deixá-lo mais atrativo e vendável: aplique pintura nova com textura realista de parede pintada e repare desgaste, trincas, sujeira, manchas e defeitos nas paredes, no teto e nos objetos fixos. Preserve os mesmos materiais, desenho, ${ids.includes("remove-furniture") ? "elementos fixos" : "mobiliário"} e estrutura, salvo alterações autorizadas pelos outros presets.`,
    "fresh-paint": `Renove a pintura das superfícies já pintadas${base.presetOptions?.["fresh-paint"]?.color ? ` na cor ${base.presetOptions["fresh-paint"]!.color}` : ""}, aplicando textura realista de parede pintada, sem substituir revestimentos.`,
    "wall-covering": "Crie com IA um novo revestimento de parede coerente com o ambiente, alterando somente o acabamento, sem alterar a estrutura.",
    flooring: `Crie com IA um novo piso / revestimento coerente com o ambiente. Aplique somente ${base.presetOptions?.flooring?.surface === "walls" ? "nas paredes" : base.presetOptions?.flooring?.surface === "both" ? "no piso visível e nas paredes" : "no piso visível"}, sem alterar a estrutura.`,
    ceiling: "Crie com IA um acabamento novo para o teto / forro, preservando luminárias e estrutura.",
    furnish: `Adicione mobília adequada para ${room}, nas áreas livres, respeitando circulação, proporções e escala. ${base.propertyContexts?.includes("Alto padrão") ? "Use uma composição visual de alto padrão." : "Use uma composição funcional e coerente com o ambiente."} Varie criativamente os móveis e a decoração, sem exigir catálogo nem inventar marcas, preços ou propriedades comerciais. Preserve as alterações realizadas nas etapas anteriores.`,
  }
  for (const id of ids) {
    const option = base.presetOptions?.[id]
    if ((option?.instructions?.length ?? 0) > 1000 || option?.color && !/^#[0-9a-f]{6}$/i.test(option.color) || option?.surface && !["floor", "walls", "both"].includes(option.surface)) throw new Error("Opções do preset inválidas ou muito extensas.")
  }
  return [
    `PRESETS_ESTUDIO: ${ids.join(",")}`,
    contextual ? `Contexto do ambiente (dados descritivos): ${JSON.stringify({ ambiente: room, imóvel: base.propertyContexts || [], cenário: base.sceneDescription?.trim() || "conforme a imagem" })}. Use este contexto para orientar estilo, escala e adequação, sem autorizar alterações fora dos presets.` : "",
    "Execute somente as etapas selecionadas abaixo, nesta ordem, em uma única imagem final: esvaziar quando solicitado, depois renovar e aplicar acabamentos selecionados, e por último mobiliar quando solicitado. Não entregue uma colagem ou uma imagem por etapa.",
    ...ids.map((id, index) => `${index + 1}. ${directions[id]}${!["remove-furniture", "renovate"].includes(id) && base.presetOptions?.[id]?.instructions?.trim() ? ` Instruções adicionais para esta etapa: ${base.presetOptions[id]!.instructions!.trim()}.` : ""}${base.materialReferences?.[id as StudioMaterialPresetId] ? ` Use o produto escolhido do catálogo: ${base.materialReferences[id as StudioMaterialPresetId]!.catalogItemName || "material de referência"}.` : ""}`),
    !ids.includes("remove-furniture") && !ids.includes("furnish") ? "Preserve os móveis existentes." : "",
    !ids.includes("fresh-paint") && !ids.includes("renovate") && !(ids.includes("flooring") && ["walls", "both"].includes(base.presetOptions?.flooring?.surface || "")) ? "Preserve a pintura existente." : "",
    "Preserve câmera, perspectiva, arquitetura e estrutura. Não altere partes não solicitadas.",
    (!ids.includes("flooring") || base.presetOptions?.flooring?.surface === "walls") ? "Preserve o piso e seus materiais e cores, salvo reparação de desgaste pela renovação." : "",
    !ids.includes("wall-covering") && !(ids.includes("flooring") && ["walls", "both"].includes(base.presetOptions?.flooring?.surface || "")) ? "Preserve os revestimentos de parede." : "",
    !ids.includes("ceiling") && !(ids.includes("fresh-paint") && base.paintCeiling) ? "Preserve o teto e o forro, salvo reparação de desgaste pela renovação." : "",
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
    "Preserve a câmera, a perspectiva e a arquitetura do ambiente.",
    references.length ? "Aplique as referências em conjunto, na ordem enviada, seguindo a instrução. Cada referência de preset deve orientar somente sua etapa indicada; preserve a câmera e a arquitetura da imagem base." : "",
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
    : preset === "flooring" ? `Aplique ${base.presetOptions?.flooring?.surface === "walls" ? "nas paredes, preservando o piso" : base.presetOptions?.flooring?.surface === "both" ? "no piso visível e nas paredes" : "em todo o piso visível, preservando paredes"}, teto e objetos devem ser preservados.` : preset === "ceiling" ? "Aplique em todo o teto / forro, preservando luminárias, paredes, piso e objetos."
    : preset === "renovate" ? "Renove a pintura e repare defeitos nas paredes, no teto e nos objetos fixos. Preserve estrutura e materiais; deixe o ambiente mais atrativo."
    : preset === "furnish" ? `Adicione apenas os itens do catálogo enviados como referências. Preserve todo o mobiliário e todas as edições já presentes na imagem. ${options.placement?.trim() ? `Posição solicitada (orientação semântica, sem garantia espacial): ${options.placement.trim()}.` : "Distribua os itens nas áreas livres respeitando circulação."}` : options.removeFixedFurniture && preset === "remove-furniture" ? "Retire também as instalações fixas solicitadas; preserve pintura, revestimentos, piso, teto e estrutura. Não adicione móveis ou objetos." : "Preserve pintura, revestimentos, piso, teto e elementos fixos."
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
    return [{ ...reference, caption: `Referência para a etapa ${STUDIO_PRESETS.find(preset => preset.id === id)!.label}` }]
  })
  const refs: StudioImageArtifact[] = [...uploaded, ...furniture.map(item => ({ source: "catalog" as const, mediaUrl: item.imageUrl, catalogItemId: item.id, catalogItemName: item.name, catalogSku: item.sku, createdAt: item.createdAt }))]
  const input = buildStudioInput(slug, working, refs, "")
  input.prompt += [
    ids.includes("fresh-paint") ? options.includeCeiling ? "Inclua também o teto pintado." : "Na etapa de pintura, preserve o teto e o forro; não os pinte." : "",
    furniture.length ? "Na etapa de mobiliar, use apenas os móveis do catálogo enviados como referências, preservando as etapas anteriores." : "",
    options.placement?.trim() ? `Local de aplicação indicado manualmente: ${options.placement.trim()}.` : "",
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
