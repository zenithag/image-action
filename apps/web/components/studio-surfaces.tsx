"use client"

import { useEffect, useRef, useState } from "react"
import type { StudioImageArtifact } from "@/lib/studio-draft"
import { getStudioArtifactKey } from "@/lib/studio-draft"
import { getContainedImageRect, getStudioSurfaceSourceKey, getCurrentSurfaceAnalysis, toggleSurfaceSelection, validateSurfaceAnalysis } from "@/lib/studio-surfaces"
import styles from "./studio-batch.module.css"

const labels = { wall: "Parede", floor: "Piso", ceiling: "Teto" }
export function StudioSurfaces({ slug, base, visible, disabled, onUpdate, targetKey, allowedTypes, onConfirmSelection, onCancelSelection }: { slug: string; base: StudioImageArtifact; visible: boolean; disabled: boolean; onUpdate: (key: string, patch: Partial<StudioImageArtifact>) => void; targetKey?: string; allowedTypes?: ("wall" | "floor" | "ceiling")[]; onConfirmSelection?: (ids: string[]) => void; onCancelSelection?: () => void }) {
  const [sourceKey, setSourceKey] = useState("")
  const [hovered, setHovered] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const controls = useRef<HTMLDivElement>(null)
  const picking = Boolean(onConfirmSelection)
  useEffect(() => { if (visible && picking) controls.current?.focus() }, [visible, picking])
  const root = useRef<HTMLDivElement>(null), request = useRef<AbortController | null>(null)
  const update = useRef(onUpdate); update.current = onUpdate
  const analysis = getCurrentSurfaceAnalysis(base.surfaceAnalysis, sourceKey, slug)
  const selected = analysis ? (base.selectedSurfaceIds || []).filter(id => analysis.surfaces.some(s => s.id === id && (!allowedTypes || allowedTypes.includes(s.type)))) : []
  const artifactKey = targetKey || getStudioArtifactKey(base)
  const eligible = analysis?.surfaces.filter(surface => !allowedTypes || allowedTypes.includes(surface.type)) || []

  useEffect(() => {
    let cancelled = false
    setSourceKey(""); setHovered(null); setError(null); setBusy(false)
    request.current?.abort()
    // Include the result identity: never reuse original contours on a generated image.
    void getStudioSurfaceSourceKey(base.mediaUrl, base.selectedPresetVersionId).then(hash => { if (!cancelled) setSourceKey(hash) })
    return () => { cancelled = true; request.current?.abort() }
  }, [base.mediaUrl, base.selectedPresetVersionId, slug])
  useEffect(() => {
    if (sourceKey && !analysis && base.selectedSurfaceIds?.length) update.current(artifactKey, { selectedSurfaceIds: [], surfaceMaterialId: undefined })
  }, [sourceKey, analysis, base.selectedSurfaceIds, artifactKey])
  useEffect(() => {
    if (!root.current) return
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])

  async function analyze() {
    if (!sourceKey || busy || disabled || !visible || analysis) return
    const controller = new AbortController(); request.current = controller
    setBusy(true); setError(null)
    try {
      const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/studio/surfaces`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: base.mediaUrl, conversationId: base.source === "inbox" ? base.conversationId : undefined, messageId: base.source === "inbox" ? base.messageId : undefined }), signal: controller.signal })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Falha no reconhecimento.")
      validateSurfaceAnalysis(payload)
      if (!controller.signal.aborted) update.current(artifactKey, { surfaceAnalysis: { ...payload, sourceKey, tenantSlug: slug, sourceVersionId: base.selectedPresetVersionId || "original" }, selectedSurfaceIds: [], selectedSurfaceSourceKey: undefined })
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Falha no reconhecimento.") }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  function select(id: string) { if (!disabled) onUpdate(artifactKey, { selectedSurfaceIds: toggleSurfaceSelection(selected, id) }) }
  const rect = getContainedImageRect(box.width, box.height, analysis?.width || 0, analysis?.height || 0)
  return <div ref={root} className={styles.surfaceLayer} hidden={!visible}>
    {analysis && <svg className={styles.surfaceOverlay} style={rect} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Planos identificados; Enter ou espaço alterna seleção">
      {eligible.map(surface => <g key={surface.id} role="button" tabIndex={disabled ? -1 : 0} aria-label={`${labels[surface.type]} ${surface.id.split("-")[1]} — indicação aproximada de plano`} aria-pressed={selected.includes(surface.id)} onMouseEnter={() => setHovered(surface.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(surface.id)} onBlur={() => setHovered(null)} onClick={() => select(surface.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(surface.id) } }} data-active={hovered === surface.id || selected.includes(surface.id)} data-selected={selected.includes(surface.id)}>
        <title>{labels[surface.type]} {surface.id.split("-")[1]}</title>
        {surface.contours.map((points, index) => <polygon key={index} points={points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")} vectorEffect="non-scaling-stroke" />)}
      </g>)}
    </svg>}
    <div className={styles.surfaceControls} tabIndex={-1} ref={controls} onKeyDown={event => { if (event.key === "Escape" && onCancelSelection) { event.preventDefault(); event.stopPropagation(); onCancelSelection() } }}>
      {onConfirmSelection && <p>Selecione os planos na imagem e confirme a seleção. Você pode escolher mais de uma.</p>}
      {!analysis ? <button type="button" disabled={busy || disabled || !sourceKey} onClick={() => void analyze()}>{busy ? "Reconhecendo superfícies…" : "Reconhecer superfícies"}</button> : <>
        <div className={styles.surfaceActions}>{(["wall", "floor", "ceiling"] as const).filter(type => !allowedTypes || allowedTypes.includes(type)).map(type => <button key={type} type="button" disabled={disabled || !analysis.surfaces.some(s => s.type === type)} onClick={() => onUpdate(artifactKey, { selectedSurfaceIds: [...new Set([...selected, ...analysis.surfaces.filter(s => s.type === type).map(s => s.id)])] })}>{type === "wall" ? "Todas as paredes" : labels[type]}</button>)}<button type="button" disabled={disabled || !selected.length} onClick={() => onUpdate(artifactKey, { selectedSurfaceIds: [], surfaceMaterialId: undefined })}>Limpar seleção</button></div>
        <p role="status">{analysis.surfaces.length} planos · {selected.length} selecionadas</p>
        <p>Indicação aproximada de plano. A geração será orientada a preservar os demais elementos, sem isolamento exato de pixels.</p>
        {!analysis.surfaces.length && <p>Nenhum contorno válido retornado. Não foi criada uma área artificial.</p>}
        {analysis.warnings.length > 0 && <p>{analysis.warnings.length} contornos/avisos rejeitados pela validação.</p>}
      </>}
      {onConfirmSelection && <div className={styles.surfaceActions}><button type="button" disabled={disabled || busy || !selected.length} onClick={() => onConfirmSelection(selected)}>Confirmar seleção ({selected.length})</button><button type="button" disabled={busy} onClick={onCancelSelection}>Cancelar seleção</button></div>}
      {busy && <progress aria-label="Análise de superfícies em andamento" />}
      {error && <p role="alert">{error}</p>}
    </div>
  </div>
}
