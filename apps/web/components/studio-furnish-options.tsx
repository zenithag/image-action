"use client"

import { useEffect, useRef } from "react"
import type { StudioImageArtifact } from "@/lib/studio-draft"
import { getStudioArtifactKey } from "@/lib/studio-draft"
import { toggleStudioPreset } from "@/lib/studio-v1"
import styles from "./studio-batch.module.css"

export function StudioFurnishOptions({ base, open, id, disabled, onClose, onUpdate }: { base: StudioImageArtifact; open: boolean; id: string; disabled: boolean; onClose: () => void; onUpdate: (key: string, patch: Partial<StudioImageArtifact>) => void }) {
  const firstControl = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) firstControl.current?.focus() }, [open])
  return <section id={id} className={`${styles.paintCatalog} ${styles.furnishOptions}`} data-state={open ? "open" : "closed"} inert={!open} aria-hidden={!open} aria-label="Opções para mobiliar o ambiente ativo" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); onClose() } }}>
    <label><input ref={firstControl} type="checkbox" checked={base.presetIds?.includes("furnish") === true} disabled={disabled} onChange={() => onUpdate(getStudioArtifactKey(base), { presetIds: toggleStudioPreset(base, "furnish").presetIds })} />Usar Mobiliar na composição</label>
    <label>Tipo de cômodo<select value={base.roomType || "auto"} disabled={disabled} onChange={event => onUpdate(getStudioArtifactKey(base), { roomType: event.target.value as StudioImageArtifact["roomType"] })}><option value="auto">Conforme a imagem</option><option value="living-room">Sala de estar</option><option value="bedroom">Quarto</option></select></label>
    <label><input type="checkbox" checked={base.furnishingLuxury === true} disabled={disabled} onChange={event => onUpdate(getStudioArtifactKey(base), { furnishingLuxury: event.target.checked })} />Alto padrão</label>
    <p>Mobiliar e Remover móveis são alternativas: a última escolha prevalece. Ajustes manuais são preservados.</p>
    <p>Use Gerar composição para processar. Clique neste ícone novamente para recolher.</p>
  </section>
}
