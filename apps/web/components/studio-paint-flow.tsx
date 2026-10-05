"use client"

import { useEffect, useRef, useState } from "react"
import type { CSSProperties, MutableRefObject } from "react"
import { Dialog } from "radix-ui"
import { Paintbrush, X } from "lucide-react"
import Link from "next/link"
import { SafeImage } from "@/components/safe-image"
import type { CatalogItem } from "@/lib/catalog-types"
import type { CompositionJob } from "@/lib/composition-types"
import type { StudioImageArtifact, StudioPresetId } from "@/lib/studio-draft"
import { getStudioArtifactKey } from "@/lib/studio-draft"
import { buildStudioPresetInput, recordStudioPresetResult, removeStudioPresetVersion, chooseStudioFurniture, getStudioFurniture, getStudioWorkingBase, isStudioMaterialPreset, STUDIO_PRESETS, getStudioPaintSwatch, getStudioPaintPreviewSource, getStudioMaterials, readStudioPaintJob, submitStudioPaintJob } from "@/lib/studio-v1"
import { cn } from "@/lib/utils"
import styles from "./studio-batch.module.css"
import overviewStyles from "./tenant-overview.module.css"

type Selection = { item?: CatalogItem; furniture?: CatalogItem[]; base: StudioImageArtifact; key: string; strength: number; preset: StudioPresetId }
const jobLabels = { queued: "Na fila", processing: "Aplicando alteração", done: "Alteração aplicada", failed: "A aplicação falhou" }

export function StudioPaintFlow({ slug, base, strength, preset, catalogId, open, onClose, onUpdate, operationLock, onBusy, disabled }: {
  slug: string; base: StudioImageArtifact; manual: string; strength: number; preset: StudioPresetId; catalogId: string; open: boolean
  onClose: () => void; onUpdate: (key: string, patch: Partial<StudioImageArtifact>) => void
  operationLock: MutableRefObject<boolean>; onBusy: (busy: boolean) => void; disabled: boolean
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Record<string, CompositionJob>>({})
  const [pollErrors, setPollErrors] = useState<Record<string, string>>({})
  const [removeFixedFurniture, setRemoveFixedFurniture] = useState(false)
  const [includeCeiling, setIncludeCeiling] = useState(false)
  const [aggregate, setAggregate] = useState(true)
  const [placement, setPlacement] = useState("")
  const [sku, setSku] = useState("")
  const [selectedFurniture, setSelectedFurniture] = useState<string[]>([])
  const [furnitureMode, setFurnitureMode] = useState<"manual" | "automatic">("manual")
  const [luxury, setLuxury] = useState(base.furnishingLuxury === true)
  const [room, setRoom] = useState<StudioImageArtifact["roomType"]>(base.roomType && base.roomType !== "auto" ? base.roomType : "living-room")
  const catalogRef = useRef<HTMLElement>(null)
  const requestIds = useRef(new Map<string, string>())
  const submittingLock = useRef(false)
  const baseRef = useRef(base)
  baseRef.current = base
  const updateRef = useRef(onUpdate)
  updateRef.current = onUpdate
  const key = getStudioArtifactKey(base)
  const job = base.paintJobId && jobs[base.paintJobId]?.tenantSlug === slug ? jobs[base.paintJobId] : undefined
  const visibleItems = isStudioMaterialPreset(preset) ? getStudioMaterials(items, slug, preset) : getStudioFurniture(items, slug).filter(item => furnitureMode === "automatic" ? selectedFurniture.includes(item.id) : !sku.trim() || `${item.sku || ""} ${item.name}`.toLowerCase().includes(sku.trim().toLowerCase()))
  const presetLabel = STUDIO_PRESETS.find(item => item.id === preset)!.label
  const pending = Boolean(base.paintJobId && (!job || job.status === "queued" || job.status === "processing"))
  const working = getStudioWorkingBase(base)
  const selectedVersion = base.presetVersions?.find(version => version.jobId === base.selectedPresetVersionId)

  useEffect(() => { onBusy(pending || submitting); return () => onBusy(false) }, [pending, submitting, onBusy])
  useEffect(() => { if (open) catalogRef.current?.focus() }, [open, preset])
  useEffect(() => {
    setSelection(null); setSelectedFurniture([]); setSku(""); setPlacement("")
    setRoom(baseRef.current.roomType && baseRef.current.roomType !== "auto" ? baseRef.current.roomType : "living-room")
    setLuxury(baseRef.current.furnishingLuxury === true)
  }, [slug, key, base.selectedPresetVersionId])
  useEffect(() => {
    if (!open) return
    setApplyError(null); setIncludeCeiling(false); setRemoveFixedFurniture(false); setAggregate(true)
    if (preset === "remove-furniture" || preset === "renovate") setSelection({ base: structuredClone(baseRef.current), key, strength, preset })
  }, [open, preset, key, strength])
  useEffect(() => {
    if (!open || (!isStudioMaterialPreset(preset) && preset !== "furnish")) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let refreshing = false
    setItems([])
    async function refresh() {
      if (refreshing || controller.signal.aborted) return
      refreshing = true; clearTimeout(timer); setLoading(true); setCatalogError(null)
      try {
        const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/catalog/items?view=preview`, { cache: "no-store", signal: controller.signal })
        const payload = await response.json()
        if (!response.ok || !Array.isArray(payload)) throw new Error("Não foi possível carregar o catálogo.")
        if (controller.signal.aborted) return
        const paints = isStudioMaterialPreset(preset) ? getStudioMaterials(payload, slug, preset) : getStudioFurniture(payload, slug)
        setItems(paints)
        if (!paints.length) timer = setTimeout(() => void refresh(), 5000)
      } catch (error) {
        if (!controller.signal.aborted) { setCatalogError(error instanceof Error ? error.message : "Falha no catálogo."); timer = setTimeout(() => void refresh(), 5000) }
      } finally { refreshing = false; if (!controller.signal.aborted) setLoading(false) }
    }
    const onFocus = () => { void refresh() }
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh() }
    window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onVisibility); void refresh()
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility) }
  }, [open, slug, preset])

  useEffect(() => {
    if (!open || preset !== "furnish" || furnitureMode !== "automatic") return
    if (loading || catalogError) { setSelectedFurniture([]); setApplyError(null); return }
    const chosen = chooseStudioFurniture(items, slug, room || "living-room")
    setSelectedFurniture(chosen.map(item => item.id))
    setApplyError(chosen.length || loading || catalogError ? null : "Não há móveis ou decoração ativos classificados para este cômodo no catálogo.")
  }, [open, preset, furnitureMode, room, items, slug, key, loading, catalogError])

  useEffect(() => {
    const id = base.paintJobId
    if (!id) return
    const targetKey = key
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      let again = true
      try {
        const updated = await readStudioPaintJob(slug, id!, controller.signal)
        if (controller.signal.aborted) return
        setJobs(current => ({ ...current, [id!]: updated })); setPollErrors(current => ({ ...current, [id!]: "" }))
        const latest = baseRef.current
        if (getStudioArtifactKey(latest) === targetKey && latest.paintJobId === id) {
          const patch = recordStudioPresetResult(latest, updated)
          if (patch) updateRef.current(targetKey, patch)
        }
        again = updated.status === "queued" || updated.status === "processing"
      } catch (error) {
        if (controller.signal.aborted) return
        setPollErrors(current => ({ ...current, [id!]: error instanceof Error ? error.message : "Falha ao atualizar." }))
      }
      if (again && !controller.signal.aborted) timer = setTimeout(poll, 4000)
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [slug, base.paintJobId, key])

  function confirm(item?: CatalogItem, furniture?: CatalogItem[]) {
    setApplyError(null); setIncludeCeiling(false); setPlacement("")
    setSelection({ item, furniture, base: structuredClone(base), key, strength, preset })
  }
  async function apply() {
    if (!selection || operationLock.current || submittingLock.current || pending) return
    const target = selection
    operationLock.current = true; submittingLock.current = true; setSubmitting(true); setApplyError(null)
    try {
      const targetBase = { ...target.base, roomType: room, furnishingLuxury: luxury, selectedSurfaceIds: [] }
      const body = buildStudioPresetInput(slug, targetBase, target.preset, { item: target.item, furniture: target.furniture, strength: target.strength, includeCeiling, removeFixedFurniture, aggregate, placement })
      const signature = JSON.stringify(body)
      if (!requestIds.current.has(signature)) requestIds.current.set(signature, `studio-preset:${crypto.randomUUID()}`)
      const created = await submitStudioPaintJob(slug, { ...body, sourceMessageId: requestIds.current.get(signature) })
      setJobs(current => ({ ...current, [created.id]: created }))
      const label = `${STUDIO_PRESETS.find(entry => entry.id === target.preset)!.label}${target.item ? ` · ${target.item.name}` : ""}`
      const parentVersionId = aggregate ? target.base.selectedPresetVersionId : undefined
      const version = { jobId: created.id, preset: target.preset, label, parentVersionId, manualTarget: placement.trim() || undefined, status: created.status, createdAt: created.createdAt, resultImageUrl: created.resultImageUrl }
      onUpdate(target.key, { paintJobId: created.id, pendingPresetId: target.preset, pendingPresetLabel: label, pendingParentVersionId: parentVersionId, presetVersions: [...(target.base.presetVersions || []), version], ...(created.status === "done" && created.resultImageUrl ? { selectedPresetVersionId: created.id } : {}) })
      requestIds.current.delete(signature); setSelection(null); onClose()
    } catch (error) { setApplyError(error instanceof Error ? error.message : "Não foi possível aplicar. Tente novamente.") }
    finally { operationLock.current = false; submittingLock.current = false; setSubmitting(false) }
  }

  return <>
    {selectedVersion?.status === "done" && <SafeImage src={working.mediaUrl} alt={`Versão selecionada: ${selectedVersion.label}`} className={styles.paintResult} />}
    <div className={styles.paintStatus} role="status" aria-live="polite">
      <strong>{pending ? job ? jobLabels[job.status] : "Consultando aplicação" : selectedVersion?.label || "Imagem original"}</strong>
      {pending && <progress aria-label="Processamento do preset" />}
      {base.paintJobId && pollErrors[base.paintJobId] && <span>{pollErrors[base.paintJobId]}</span>}
      {job?.status === "done" && !job.resultImageUrl && <span>O processamento terminou sem uma imagem disponível.</span>}
      {job?.status === "failed" && <span>{job.errorMessage || "A aplicação falhou. Abra o preset para tentar novamente; suas versões foram preservadas."}</span>}
      <div className={styles.presetVersions} role="group" aria-label="Versões deste ambiente; a selecionada será a base da composição">
        <button type="button" aria-label="Usar imagem original como principal" aria-pressed={!base.selectedPresetVersionId} onClick={() => onUpdate(key, { selectedPresetVersionId: undefined })}><SafeImage src={base.mediaUrl} alt="Original" /></button>
        {base.presetVersions?.filter(version => version.status === "done" && version.resultImageUrl).map(version => <div key={version.jobId} className={styles.presetVersion}>
          <button type="button" title={version.label} aria-label={`Usar ${version.label} como principal`} aria-pressed={base.selectedPresetVersionId === version.jobId} onClick={() => onUpdate(key, { selectedPresetVersionId: version.jobId })}><SafeImage src={version.resultImageUrl} alt={version.label} /></button>
          <button type="button" className={styles.presetVersionDelete} title="Excluir variação do Estúdio" aria-label={`Excluir variação ${version.label}`} disabled={pending || submitting || Boolean(selection)} onClick={() => { const patch = removeStudioPresetVersion(baseRef.current, version.jobId); if (patch) onUpdate(key, patch) }}><X size={12} aria-hidden="true" /></button>
        </div>)}
      </div>
    </div>
    <section ref={catalogRef} id={catalogId} tabIndex={-1} inert={!open} aria-hidden={!open} data-state={open && preset !== "renovate" && preset !== "remove-furniture" ? "open" : "closed"} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose() } }} className={cn(styles.paintCatalog, preset === "furnish" && styles.furnishOptions)} style={{ "--paint-visible-count": Math.min(6, Math.max(1, visibleItems.length)) } as CSSProperties} aria-label={`${presetLabel} do catálogo`}>
      {preset === "furnish" && <>
        <label>Modo<select value={furnitureMode} onChange={event => { setFurnitureMode(event.target.value as typeof furnitureMode); setSelectedFurniture([]) }}><option value="manual">Selecionar itens</option><option value="automatic">Mobiliar automaticamente</option></select></label>
        <label>Cômodo<select value={room} onChange={event => { setRoom(event.target.value as typeof room); setSelectedFurniture([]) }}><option value="living-room">Sala</option><option value="kitchen">Cozinha</option><option value="bedroom">Quarto</option><option value="bathroom">Banheiro</option></select></label>
        <label className={styles.paintCheckbox}><input type="checkbox" checked={luxury} onChange={event => setLuxury(event.target.checked)} /><span>Alto padrão visual</span></label>
        {furnitureMode === "manual" && <label>Buscar produto por SKU ou nome<input value={sku} onChange={event => setSku(event.target.value)} /></label>}
        {furnitureMode === "automatic" && <p>Até 5 itens compatíveis com o cômodo são sorteados automaticamente. Revise a seleção antes de aplicar.</p>}
      </>}
      {loading ? <p role="status">Carregando materiais…</p> : catalogError ? <p role="alert">{catalogError} Tentaremos novamente automaticamente.</p> : visibleItems.length === 0 ? <p>Nenhum item ativo compatível com {presetLabel.toLowerCase()} neste catálogo. <Link href={`/tenant/${slug}/catalog`}>Abrir catálogo</Link></p> : <div className={styles.paintItems} tabIndex={0} role="group" aria-label={`Amostras de ${presetLabel}; role horizontalmente para ver mais opções`}>
        {visibleItems.map(item => <button key={item.id} type="button" aria-label={`${item.name}${item.sku ? ` · SKU ${item.sku}` : ""}`} title={`${item.name}${item.sku ? ` · SKU ${item.sku}` : ""}`} disabled={disabled || submitting || pending || (preset === "furnish" && furnitureMode === "automatic")} aria-pressed={preset === "furnish" && selectedFurniture.includes(item.id)} onClick={() => { if (preset === "furnish") setSelectedFurniture(current => current.includes(item.id) ? current.filter(id => id !== item.id) : current.length < 5 ? [...current, item.id] : current); else confirm(item) }}>
          {getStudioPaintPreviewSource(item, slug) ? <SafeImage src={getStudioPaintPreviewSource(item, slug)} alt={item.name} loading="lazy" decoding="async" className={styles.paintThumbnail} /> : getStudioPaintSwatch(item) ? <span className={styles.paintSwatch} style={{ backgroundColor: getStudioPaintSwatch(item) }} aria-label={`Amostra ${getStudioPaintSwatch(item)}`} /> : <Paintbrush size={24} aria-hidden="true" />}
        </button>)}
      </div>}
      {preset === "furnish" && <><p>{selectedFurniture.length} de 5 itens selecionados</p><button type="button" disabled={!selectedFurniture.length || loading || Boolean(catalogError) || disabled || submitting || pending} onClick={() => confirm(undefined, selectedFurniture.flatMap(id => { const item = items.find(candidate => candidate.id === id); return item ? [item] : [] }))}>Revisar aplicação</button></>}
      {applyError && !selection && <p role="alert">{applyError}</p>}
    </section>
    <Dialog.Root open={Boolean(selection)} onOpenChange={opened => { if (!opened && !submitting) { setSelection(null); onClose() } }}>
      <Dialog.Portal><Dialog.Overlay className={styles.paintModalOverlay} /><Dialog.Content className={cn(overviewStyles.surface, styles.paintModal)}>
        <Dialog.Title>{selection?.preset === "remove-furniture" ? "Remover os móveis deste ambiente?" : `Aplicar ${STUDIO_PRESETS.find(p => p.id === selection?.preset)?.label.toLowerCase() || "preset"}?`}</Dialog.Title>
        <Dialog.Description>Ambiente: {selection?.base.caption || "Ambiente selecionado"}. {selection?.item?.name || selection?.furniture?.map(item => item.name).join(", ")}</Dialog.Description>
        {selection?.preset === "remove-furniture" && <label className={styles.paintCheckbox}><input type="checkbox" checked={removeFixedFurniture} onChange={event => setRemoveFixedFurniture(event.target.checked)} /><span>Remover também móveis e instalações fixas (pias, armários e vasos sanitários), deixando paredes, piso e teto. Preservar portas, janelas e estrutura.</span></label>}
        {selection?.preset === "renovate" && <p>Restaurar a aparência de desgaste, trincas, sujeira e manchas, preservando os mesmos materiais, cores, móveis e estrutura.</p>}
        {selection?.preset === "fresh-paint" && <label className={styles.paintCheckbox}><input type="checkbox" checked={includeCeiling} onChange={event => setIncludeCeiling(event.target.checked)} /><span>Pintar o teto também</span></label>}
        {selection && isStudioMaterialPreset(selection.preset) && <label className={styles.paintField}><span>Onde aplicar (opcional)</span><input maxLength={500} value={placement} onChange={event => setPlacement(event.target.value)} placeholder="Ex.: somente a parede à esquerda" /><p>Descreva o local em texto. Sem indicação, a aplicação segue o padrão deste preset.</p></label>}
        {selection?.preset === "flooring" && !placement.trim() && <p>Aplicar em todo o piso visível.</p>}{selection?.preset === "ceiling" && !placement.trim() && <p>Aplicar em todo o teto / forro, preservando luminárias.</p>}
        {selection?.preset === "furnish" && <><label className={styles.paintCheckbox}><input type="checkbox" checked={aggregate} onChange={event => setAggregate(event.target.checked)} /><span>Agregar à versão principal, preservando as edições anteriores</span></label><label className={styles.paintField}><span>Onde colocar os itens</span><input maxLength={500} value={placement} onChange={event => setPlacement(event.target.value)} placeholder="Ex.: mesa junto à parede esquerda" /></label><p>A posição é uma instrução descritiva; não há editor de posicionamento preciso nesta etapa.</p></>}
        <p>A aplicação gera uma versão neste Estúdio e usa créditos do plano. A imagem original é preservada. A composição geral usa a versão principal escolhida.</p>
        <p>Preservação orientada por instruções, sem garantia de isolamento de pixels.</p>
        {applyError && <p role="alert">{applyError}</p>}
        <div className={styles.paintModalActions}><Dialog.Close disabled={submitting}>Cancelar</Dialog.Close><button type="button" onClick={() => void apply()} disabled={submitting || disabled || pending}>{submitting ? "Enviando…" : "Aplicar"}</button></div>
        <Dialog.Close className={styles.paintModalClose} disabled={submitting} aria-label="Fechar confirmação"><X size={18} /></Dialog.Close>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>
}
