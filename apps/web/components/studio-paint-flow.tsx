"use client"

import type { TenantSettings } from "@/lib/tenant-settings-types"

import { Button } from "@/components/ui/button"
import { Input, NativeSelect } from "@/components/spectrum/fields"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties, MutableRefObject } from "react"
import { Check, ChevronLeft, ChevronRight, Loader2, Paintbrush, Save, X } from "@/components/spectrum/icons"
import { SafeImage } from "@/components/safe-image"
import type { CatalogItem } from "@/lib/catalog-types"
import type { CompositionJob } from "@/lib/composition-types"
import type { StudioImageArtifact, StudioPresetId } from "@/lib/studio-draft"
import { getStudioArtifactKey } from "@/lib/studio-draft"
import { buildStudioPresetsInput, STUDIO_PRESET_ORDER, recordStudioPresetResult, removeStudioPresetVersion, getStudioFurniture, getStudioWorkingBase, isStudioMaterialPreset, STUDIO_PRESETS, getStudioPaintPreviewSource, getStudioMaterials, readStudioPaintJob, submitStudioPaintJob } from "@/lib/studio-v1"
import { fileToOptimizedWebpDataUrl } from "@/lib/studio-upload"
import { cn } from "@/lib/utils"
import styles from "./studio-batch.module.css"
import overviewStyles from "./tenant-overview.module.css"

type Selection = { item?: CatalogItem; furniture?: CatalogItem[]; base: StudioImageArtifact; key: string; strength: number; preset: StudioPresetId; presets?: StudioPresetId[] }
const jobLabels = { queued: "Na fila", processing: "Aplicando alteração", done: "Alteração aplicada", failed: "A aplicação falhou" }

const SIDE_BUTTON: CSSProperties = { width: 22, height: 22, minWidth: 0, padding: 0 }

export function StudioPaintFlow({ slug, base, strength, preset, catalogId, open, onClose, onUpdate, operationLock, onBusy, disabled, studioSettings, applyRequest }: {
  studioSettings: TenantSettings["studio"]; applyRequest: number
  slug: string; base: StudioImageArtifact; strength: number; preset: StudioPresetId; catalogId: string; open: boolean
  onClose: () => void; onUpdate: (key: string, patch: Partial<StudioImageArtifact>) => void
  operationLock: MutableRefObject<boolean>; onBusy: (busy: boolean) => void; disabled: boolean
}) {
  const [useCatalog, setUseCatalog] = useState(false)
  const [catalogSelections, setCatalogSelections] = useState<Partial<Record<StudioPresetId, CatalogItem[]>>>({})
  const catalogActive = studioSettings.catalogEnabled && useCatalog
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<Record<string, CompositionJob>>({})
  const [pollErrors, setPollErrors] = useState<Record<string, string>>({})
  const [savingVersionId, setSavingVersionId] = useState<string | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [removeFixedFurniture, setRemoveFixedFurniture] = useState(false)
  const [includeCeiling, setIncludeCeiling] = useState(false)
  const aggregate = true
  const placement = ""
  const [uploadingReference, setUploadingReference] = useState(false)
  const [room, setRoom] = useState<StudioImageArtifact["roomType"]>(base.roomType && base.roomType !== "auto" ? base.roomType : "auto")
  const slidesRef = useRef<HTMLDivElement>(null)
  const [slideEdges, setSlideEdges] = useState({ start: true, end: false })
  const updateSlideEdges = () => {
    const rail = slidesRef.current
    if (rail) setSlideEdges({ start: rail.scrollLeft < 2, end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2 })
  }
  const moveSlides = (direction: number) => {
    const rail = slidesRef.current
    if (rail) rail.scrollBy({ left: direction * Math.max(92, rail.clientWidth - 92), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
  }
  useEffect(() => {
    const rail = slidesRef.current
    if (!rail) return
    rail.scrollLeft = 0
    updateSlideEdges()
    const observer = new ResizeObserver(updateSlideEdges)
    observer.observe(rail)
    for (const child of rail.children) observer.observe(child)
    return () => observer.disconnect()
  }, [preset, open, catalogActive, loading, items])
  const catalogRef = useRef<HTMLElement>(null)
  const requestIds = useRef(new Map<string, string>())
  const submittingLock = useRef(false)
  const baseRef = useRef(base)
  baseRef.current = base
  const updateRef = useRef(onUpdate)
  updateRef.current = onUpdate
  const key = getStudioArtifactKey(base)
  const job = base.paintJobId && jobs[base.paintJobId]?.tenantSlug === slug ? jobs[base.paintJobId] : undefined
  const visibleItems = isStudioMaterialPreset(preset) ? getStudioMaterials(items, slug, preset, base.presetOptions?.flooring?.surface) : getStudioFurniture(items, slug)
  const activePresets = base.combinePresets ? STUDIO_PRESET_ORDER.filter(id => base.presetIds?.includes(id)) : [preset]
  const contextualPresets = activePresets.filter(id => !["remove-furniture", "renovate"].includes(id))
  const presetLabel = STUDIO_PRESETS.find(item => item.id === preset)!.label
  const pending = Boolean(base.paintJobId && (!job || job.status === "queued" || job.status === "processing"))
  const working = getStudioWorkingBase(base)
  const selectedVersion = base.presetVersions?.find(version => version.jobId === base.selectedPresetVersionId)
  const pendingVersion = base.presetVersions?.find(version => version.jobId === base.paintJobId && (version.status === "queued" || version.status === "processing"))

  useEffect(() => { onBusy(pending || submitting || uploadingReference); return () => onBusy(false) }, [pending, submitting, uploadingReference, onBusy])
  useEffect(() => { if (open) catalogRef.current?.focus() }, [open, preset])
  useEffect(() => {
    setCatalogSelections({}); setIncludeCeiling(baseRef.current.paintCeiling === true); setRemoveFixedFurniture(baseRef.current.removeFixedFurniture === true)
    setRoom(baseRef.current.roomType && baseRef.current.roomType !== "auto" ? baseRef.current.roomType : "auto")
  }, [slug, key, base.selectedPresetVersionId])
  useEffect(() => {
    if (!open) return
    setApplyError(null)
  }, [open, preset, key, strength])
  useEffect(() => {
    if (!catalogActive || !open || (!isStudioMaterialPreset(preset) && preset !== "furnish")) return
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
        const paints = isStudioMaterialPreset(preset) ? getStudioMaterials(payload, slug, preset, base.presetOptions?.flooring?.surface) : getStudioFurniture(payload, slug)
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
  }, [open, slug, preset, catalogActive, base.presetOptions?.flooring?.surface])


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

  function updatePresetOption(id: StudioPresetId, patch: NonNullable<StudioImageArtifact["presetOptions"]>[StudioPresetId]) {
    onUpdate(key, { presetOptions: { ...base.presetOptions, [id]: { ...base.presetOptions?.[id], ...patch } } })
  }

  async function uploadReference(id: StudioPresetId, file: File) {
    if (uploadingReference || submitting || pending || disabled) return
    const targetKey = key
    setUploadingReference(true); setApplyError(null)
    try {
      const mediaUrl = await fileToOptimizedWebpDataUrl(file)
      const current = baseRef.current
      if (getStudioArtifactKey(current) !== targetKey) return
      onUpdate(targetKey, { presetOptions: { ...current.presetOptions, [id]: { ...current.presetOptions?.[id], reference: { source: "upload", mediaUrl, caption: file.name, createdAt: new Date().toISOString() } } } })
    } catch (error) { setApplyError(error instanceof Error ? error.message : "Não foi possível carregar a referência.") }
    finally { setUploadingReference(false) }
  }

  async function apply(target: Selection) {
    if (disabled || uploadingReference || !target || operationLock.current || submittingLock.current || pending) return
    operationLock.current = true; submittingLock.current = true; setSubmitting(true); setApplyError(null)
    try {
      const targetBase = { ...target.base, roomType: room, presetOptions: { ...target.base.presetOptions, "fresh-paint": { color: "#ffffff", ...target.base.presetOptions?.["fresh-paint"] } }, selectedSurfaceIds: [] }
      const presets = target.presets || [target.preset]
      const materials = Object.fromEntries(presets.filter(isStudioMaterialPreset).flatMap(id => {
        const item = target.item && id === target.preset ? target.item : catalogSelections[id]?.[0]
        return item ? [[id, item]] : []
      }))
      const body = buildStudioPresetsInput(slug, targetBase, presets, { strength: target.strength, includeCeiling, removeFixedFurniture, aggregate, placement, materials: catalogActive ? materials : undefined, furniture: catalogActive ? target.furniture || catalogSelections.furnish : undefined })
      const signature = JSON.stringify(body)
      if (!requestIds.current.has(signature)) requestIds.current.set(signature, `studio-preset:${crypto.randomUUID()}`)
      const created = await submitStudioPaintJob(slug, { ...body, sourceMessageId: requestIds.current.get(signature) })
      setJobs(current => ({ ...current, [created.id]: created }))
      const label = STUDIO_PRESET_ORDER.filter(id => presets.includes(id)).map(id => STUDIO_PRESETS.find(entry => entry.id === id)!.label).join(" + ")
      const parentVersionId = aggregate ? target.base.selectedPresetVersionId : undefined
      const version = { jobId: created.id, preset: target.preset, presetIds: body.presetIds, label, parentVersionId, manualTarget: placement.trim() || undefined, status: created.status, createdAt: created.createdAt, resultImageUrl: created.resultImageUrl }
      onUpdate(target.key, { paintJobId: created.id, pendingPresetId: target.preset, pendingPresetLabel: label, pendingParentVersionId: parentVersionId, presetVersions: [...(target.base.presetVersions || []), version], ...(created.status === "done" && created.resultImageUrl ? { selectedPresetVersionId: created.id } : {}) })
      requestIds.current.delete(signature); onClose()
    } catch (error) { setApplyError(error instanceof Error ? error.message : "Não foi possível aplicar. Tente novamente.") }
    finally { operationLock.current = false; submittingLock.current = false; setSubmitting(false) }
  }

  useEffect(() => {
    if (!applyRequest || !baseRef.current.combinePresets || !baseRef.current.presetIds?.length) return
    const snapshot = structuredClone(baseRef.current)
    void apply({ base: snapshot, key: getStudioArtifactKey(snapshot), strength, preset: snapshot.presetIds![0], presets: snapshot.presetIds })
    // Only an explicit toolbar click submits a job, never a selection or scene switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRequest])

  // Saves a preset result into Compositions (preset images are hidden from that list until saved).
  async function saveVersionAsComposition(versionId: string) {
    if (savingVersionId) return

    setSavingVersionId(versionId)
    setSaveNote(null)

    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs/${encodeURIComponent(versionId)}/save`, { method: "POST" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar em Composições.")

      const current = baseRef.current
      updateRef.current(key, {
        presetVersions: (current.presetVersions || []).map(version => version.jobId === versionId ? { ...version, savedAsComposition: true } : version),
      })
      setSaveNote("Imagem salva em Composições.")
    } catch (error) {
      setSaveNote(error instanceof Error ? error.message : "Não foi possível salvar em Composições.")
    } finally {
      setSavingVersionId(null)
    }
  }

  return <>
    {selectedVersion?.status === "done" && <SafeImage src={working.mediaUrl} alt={`Versão selecionada: ${selectedVersion.label}`} className={styles.paintResult} />}
    <div className={styles.paintStatus} role="status" aria-live="polite">
      <strong>{pending ? job ? jobLabels[job.status] : "Consultando aplicação" : selectedVersion?.label || "Imagem original"}</strong>
      {pending && <progress aria-label="Processamento do preset" />}
      {saveNote && <span>{saveNote}</span>}
      {base.paintJobId && pollErrors[base.paintJobId] && <span>{pollErrors[base.paintJobId]}</span>}
      {job?.status === "done" && !job.resultImageUrl && <span>O processamento terminou sem uma imagem disponível.</span>}
      {job?.status === "failed" && <span>{job.errorMessage || "A aplicação falhou. Abra o preset para tentar novamente; suas versões foram preservadas."}</span>}
      <div className={styles.presetVersions} role="group" aria-label="Versões deste ambiente; a selecionada será a base da composição">
        <button type="button" aria-label="Usar imagem original como principal" aria-pressed={!base.selectedPresetVersionId} onClick={() => onUpdate(key, { selectedPresetVersionId: undefined })}><SafeImage src={base.mediaUrl} alt="Original" /></button>
        {pendingVersion && <div className={styles.presetVersion} data-glass="">
          <div className={styles.presetVersionPending} role="img" aria-label={`${pendingVersion.label} — imagem em geração`} aria-busy="true">
            <SafeImage src={job?.baseImageUrl || base.presetVersions?.find(version => version.jobId === pendingVersion.parentVersionId)?.resultImageUrl || base.mediaUrl} alt="" />
            <span className={styles.presetThumbnailLoader} aria-hidden="true"><span className={styles.presetThumbnailSpinner} /></span>
          </div>
        </div>}
        {base.presetVersions?.filter(version => version.status === "done" && version.resultImageUrl).map(version => <div key={version.jobId} className={styles.presetVersion} data-glass="">
          <button type="button" title={version.label} aria-label={`Usar ${version.label} como principal`} aria-pressed={base.selectedPresetVersionId === version.jobId} onClick={() => onUpdate(key, { selectedPresetVersionId: version.jobId })}><SafeImage src={version.resultImageUrl} alt={version.label} /></button>
          <div className={styles.presetVersionActions}>
          <Button variant="ghost" size="icon" type="button" style={SIDE_BUTTON} title="Excluir variação do Estúdio" aria-label={`Excluir variação ${version.label}`} disabled={pending || submitting} onClick={() => { const patch = removeStudioPresetVersion(baseRef.current, version.jobId); if (patch) onUpdate(key, patch) }}><X size={11} aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" type="button" style={SIDE_BUTTON} title={version.savedAsComposition ? "Salva em Composições" : "Salvar em Composições"} aria-label={version.savedAsComposition ? `${version.label} já está salva em Composições` : `Salvar ${version.label} em Composições`} disabled={version.savedAsComposition === true || savingVersionId !== null || pending} onClick={() => void saveVersionAsComposition(version.jobId)}>{savingVersionId === version.jobId ? <Loader2 size={11} aria-hidden="true" /> : version.savedAsComposition ? <Check size={11} aria-hidden="true" /> : <Save size={11} aria-hidden="true" />}</Button>
          </div>
        </div>)}
      </div>
    </div>
    <section ref={catalogRef} id={catalogId} tabIndex={-1} inert={!open} aria-hidden={!open} data-state={open ? "open" : "closed"} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose() } }} className={cn(styles.paintCatalog, styles.furnishOptions)} aria-label="Opções dos presets">
      <strong>{base.combinePresets ? "Combinar presets" : presetLabel}</strong>
      {base.combinePresets && <p>Ordem: {STUDIO_PRESET_ORDER.filter(id => base.presetIds?.includes(id)).map(id => STUDIO_PRESETS.find(value => value.id === id)!.label).join(" → ") || "Selecione os presets na barra abaixo."}</p>}
      {contextualPresets.length > 0 && <>
      <label>Tipo de ambiente<NativeSelect aria-label="Tipo de ambiente" value={room || "auto"} onChange={event => { setRoom(event.target.value); onUpdate(key, { roomType: event.target.value }) }}><option value="auto">Conforme a imagem</option>{[...new Set([...(studioSettings.environmentTypes || []), ...(room && room !== "auto" ? [room] : [])])].map(value => <option key={value} value={value}>{value}</option>)}</NativeSelect></label>
      <fieldset><legend>Contexto do imóvel</legend><div className={styles.contextTags}>{studioSettings.propertyContexts.map(value => <label key={value}><Input type="checkbox" checked={base.propertyContexts?.includes(value) === true} onChange={event => onUpdate(key, { propertyContexts: event.target.checked ? [...(base.propertyContexts || []), value] : base.propertyContexts?.filter(item => item !== value) })} />{value}</label>)}</div></fieldset>
      <label className={styles.sceneDescription}>Descrição do cenário (opcional)<textarea aria-label="Descrição do cenário" rows={2} maxLength={1000} value={base.sceneDescription || ""} placeholder="Ex.: apartamento compacto com luz natural" onChange={event => onUpdate(key, { sceneDescription: event.target.value })} /></label>
      </>}
      {activePresets.includes("remove-furniture") && <Input type="checkbox" checked={removeFixedFurniture} onChange={event => { setRemoveFixedFurniture(event.target.checked); onUpdate(key, { removeFixedFurniture: event.target.checked }) }}>Remover também móveis e instalações fixas</Input>}
      {activePresets.includes("fresh-paint") && <Input type="checkbox" checked={includeCeiling} onChange={event => { setIncludeCeiling(event.target.checked); onUpdate(key, { paintCeiling: event.target.checked }) }}>Pintar o teto também</Input>}
      {activePresets.includes("fresh-paint") && <label className={styles.paintColor}>Cor da pintura<input type="color" aria-label="Cor da pintura" value={base.presetOptions?.["fresh-paint"]?.color || "#ffffff"} onChange={event => updatePresetOption("fresh-paint", { color: event.target.value })} /><span>{base.presetOptions?.["fresh-paint"]?.color || "#ffffff"}</span></label>}
      {activePresets.includes("flooring") && <label>Aplicar revestimento em<NativeSelect aria-label="Aplicar revestimento em" value={base.presetOptions?.flooring?.surface || "floor"} onChange={event => updatePresetOption("flooring", { surface: event.target.value as "floor" | "walls" | "both" })}><option value="floor">Piso</option><option value="walls">Paredes</option><option value="both">Piso e paredes</option></NativeSelect></label>}
      {contextualPresets.map(id => <fieldset key={id}>
        {base.combinePresets && <legend>{STUDIO_PRESETS.find(item => item.id === id)!.label}</legend>}
        <label className={styles.sceneDescription}>Instruções adicionais (opcional)<textarea aria-label={base.combinePresets ? `Instruções adicionais: ${STUDIO_PRESETS.find(item => item.id === id)!.label}` : "Instruções adicionais"} rows={2} maxLength={1000} value={base.presetOptions?.[id]?.instructions || ""} placeholder="Ex.: acabamento fosco, mantendo os detalhes existentes" onChange={event => updatePresetOption(id, { instructions: event.target.value })} /></label>
        <label className={styles.presetReference}>Referência de imagem (opcional)<input type="file" aria-label={`Referência de imagem: ${STUDIO_PRESETS.find(item => item.id === id)!.label}`} accept="image/jpeg,image/png,image/webp" disabled={disabled || submitting || pending || uploadingReference} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadReference(id, file) }} /></label>
        {base.presetOptions?.[id]?.reference && <div className={styles.presetReferencePreview}><SafeImage src={base.presetOptions[id]!.reference!.mediaUrl} alt={`Referência para ${STUDIO_PRESETS.find(item => item.id === id)!.label}`} /><button type="button" disabled={uploadingReference || submitting || pending} onClick={() => updatePresetOption(id, { reference: undefined })}>Remover referência</button></div>}
      </fieldset>)}
      {uploadingReference && <p role="status">Preparando referência…</p>}
      {studioSettings.catalogEnabled && contextualPresets.length > 0 && <Input type="checkbox" checked={catalogActive} onChange={event => setUseCatalog(event.target.checked)}>Usar produtos do catálogo (opcional)</Input>}
      {catalogActive && (isStudioMaterialPreset(preset) || preset === "furnish") && <>
        <strong>Produtos para {presetLabel.toLowerCase()}</strong>
        {loading ? <p role="status">Carregando materiais…</p> : catalogError ? <p role="alert">{catalogError}</p> : visibleItems.length === 0 ? <p>Nenhum item compatível. Você pode desmarcar o catálogo e gerar com IA.</p> : <div className={styles.paintSlider}>
          <button type="button" className={styles.slideArrow} aria-label="Amostras anteriores" disabled={slideEdges.start} onClick={() => moveSlides(-1)}><ChevronLeft size={18} /></button>
          <div ref={slidesRef} onScroll={updateSlideEdges} className={styles.paintItems} tabIndex={0} role="group" aria-label="Produtos opcionais do catálogo" onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); moveSlides(event.key === "ArrowRight" ? 1 : -1) } }}>
          {visibleItems.map(item => <button key={item.id} type="button" title={item.name} aria-label={item.name} disabled={disabled || submitting || pending || uploadingReference} aria-pressed={catalogSelections[preset]?.some(value => value.id === item.id) === true} onClick={() => setCatalogSelections(current => {
            const selected = current[preset] || []
            return { ...current, [preset]: selected.some(value => value.id === item.id) ? selected.filter(value => value.id !== item.id) : preset === "furnish" ? [...selected, item].slice(0, 5) : [item] }
          })}>{getStudioPaintPreviewSource(item, slug) ? <SafeImage src={getStudioPaintPreviewSource(item, slug)} alt={item.name} className={styles.paintThumbnail} /> : <Paintbrush size={24} />}<span>{item.name}</span></button>)}
          </div>
          <button type="button" className={styles.slideArrow} aria-label="Próximas amostras" disabled={slideEdges.end} onClick={() => moveSlides(1)}><ChevronRight size={18} /></button>
        </div>}
      </>}
      <p>Uma geração por aplicação. Móveis e acabamentos são criados pela IA; câmera e estrutura devem ser preservadas.</p>
      {!base.combinePresets && <Button type="button" disabled={disabled || submitting || pending || uploadingReference} onClick={() => void apply({ base: structuredClone(baseRef.current), key, strength, preset })}>{submitting ? "Enviando…" : "Aplicar"}</Button>}
      {applyError && <p role="alert">{applyError}</p>}
    </section>

  </>
}
