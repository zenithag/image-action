"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { getThemeContainer } from "@/components/spectrum/theme-container"
import { PresetIcon } from "@/components/spectrum/preset-icons"
import { ToggleButton } from "@/components/spectrum/toggle-button"
import { Button } from "@/components/ui/button"
import { Input, NativeSelect, Textarea } from "@/components/spectrum/fields"
import { use, useEffect, useId, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import Link from "next/link"
import { Popover } from "radix-ui"
import styles from "./studio-batch.module.css"
import overviewStyles from "./tenant-overview.module.css"
import { useRouter } from "next/navigation"
import { FolderOpen, Circle, ArrowRight, Check, ChevronRight, Info, Loader2, Minus, PanelRightClose, PanelRightOpen, Plus, Sparkles, X, Image as ImageIcon } from "@/components/spectrum/icons"

import { SafeImage } from "@/components/safe-image"
import { StudioPaintFlow } from "@/components/studio-paint-flow"
import { StudioResults } from "@/components/studio-results"
import type { CompositionJob, CompositionJobInput } from "@/lib/composition-types"
import type {
  StudioCompositionStrategy,
  StudioDraft,
  StudioImageArtifact,
  StudioPresetId,
  StudioScenario,
} from "@/lib/studio-draft"
import {
  getStudioArtifactKey,
  getStudioDraftStorageKey,
  ensureStudioScenarios,
  planStudioScenarios,
  expandStudioScenarioVariations,
} from "@/lib/studio-draft"
import { cn } from "@/lib/utils"
import { buildStudioCompositionInput, STUDIO_PRESETS, getEnvironmentReferences, IMAGE_TYPES, MAX_REFERENCES, MAX_REQUEST_BYTES, MAX_UPLOAD_BYTES, validateStudioFiles } from "@/lib/studio-v1"
import { loadStudioSession, saveStudioSession } from "@/lib/studio-v1-storage"

function parseDraft(value: string | null): StudioDraft {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value) as StudioDraft
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function formatSourceLabel(image: StudioImageArtifact | null) {
  if (!image) return "Aguardando imagem do Inbox"

  if (image.source === "catalog") {
    return [
      image.catalogItemName || "Produto do catalogo",
      image.catalogSku ? `SKU ${image.catalogSku}` : "",
    ].filter(Boolean).join(" - ")
  }

  if (image.source === "upload") {
    return image.caption || "Upload do dispositivo"
  }

  return [
    image.contactName || "Conversa",
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(image.createdAt)),
  ].join(" - ")
}


const uploadMaxDimension = 2000
const uploadWebpQuality = 0.88

function loadBrowserImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem selecionada."))
    image.src = url
  })
}

function canvasToWebpDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel converter a imagem para WebP."))
        return
      }

      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ""))
      reader.onerror = () => reject(new Error("Nao foi possivel carregar a imagem convertida."))
      reader.readAsDataURL(blob)
    }, "image/webp", uploadWebpQuality)
  })
}

async function fileToOptimizedWebpDataUrl(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error("Use imagens JPG, PNG ou WebP.")
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Cada imagem deve ter no máximo 15 MB.")
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadBrowserImage(objectUrl)
    const scale = Math.min(
      1,
      uploadMaxDimension / image.naturalWidth,
      uploadMaxDimension / image.naturalHeight
    )
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Nao foi possivel otimizar a imagem selecionada.")
    }

    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    return canvasToWebpDataUrl(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function UploadCollection({ title, count, description, reference = false, images, onUpload, onRemove, disabled, slug }: {
  title: string; count: string; description: string; reference?: boolean; images: StudioImageArtifact[]; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onRemove: (index: number) => void; disabled: boolean; slug: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [expanded, setExpanded] = useState(true)
  const contentId = useId()
  return <section className={styles.inputSection}>
    <div className={styles.uploadHeading}>
      <h3><button type="button" className={styles.sectionToggle} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(open => !open)}><ChevronRight size={14} aria-hidden="true" />{title}<span>{count}</span></button></h3>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="ghost" size="icon" type="button" aria-label={`Informações sobre ${title.toLowerCase()}`}><Info size={16} aria-hidden="true" /></Button>
        </Popover.Trigger>
        <Popover.Portal container={getThemeContainer()}>
          <Popover.Content className={cn(overviewStyles.surface, styles.uploadHelpContent)} side="left" align="start" sideOffset={8} collisionPadding={12} aria-label={`Informações sobre ${title.toLowerCase()}`}>
            <Popover.Close asChild>
              <Button variant="ghost" size="icon" type="button" aria-label="Fechar informações" style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, minWidth: 0, padding: 0 }}><X size={14} aria-hidden="true" /></Button>
            </Popover.Close>
            <p>{description}</p>
            <p>{reference ? "Adicionar referências. Selecione imagens do seu dispositivo." : "Adicione fotos do ambiente ou selecione arquivos do seu dispositivo."}</p>
            <p>Use imagens JPG, PNG ou WebP de até 15 MB cada.</p>
            {reference && <p>As referências selecionadas serão aplicadas juntas em cada ambiente.</p>}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
    <div id={contentId} hidden={!expanded}>
    <div className={styles.dropzone}>
      <ImageIcon size={20} aria-hidden="true" />
      <Button variant="outline" type="button" onClick={() => input.current?.click()} disabled={disabled}><FolderOpen size={16} />Selecionar arquivos</Button>
      <Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label={reference ? "Selecionar referências" : "Selecionar ambientes"} disabled={disabled} onChange={onUpload} />
    </div>
    {images.length > 0 && <div className={styles.uploaded}>{images.map((image, index) => <div key={`${getStudioArtifactKey(image)}:${index}`}><SafeImage src={image.mediaUrl} alt={image.caption || `${title} ${index + 1}`} className={styles.thumbnail} /><Button variant="ghost" size="icon" type="button" aria-label={`Remover ${reference ? "referência" : "ambiente"} ${index + 1}`} disabled={disabled} onClick={() => onRemove(index)}><X size={14} /></Button></div>)}</div>}
    </div>
  </section>
}


const QUICK_TAGS = [
  "manter moveis",
  "preservar arquitetura",
  "iluminacao natural",
  "acabamento realista",
] as const

export default function StudioBatchPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()
  const [previewTab, setPreviewTab] = useState<"base" | "preview">("base")
  const baseInput = useRef<HTMLInputElement>(null)
  const storageKey = useMemo(() => getStudioDraftStorageKey(slug), [slug])

  // Multi-cenários e multi-referências
  const [baseImages, setBaseImages] = useState<StudioImageArtifact[]>([])
  const [activeBaseIndex, setActiveBaseIndex] = useState(0)
  const [scenarios, setScenarios] = useState<StudioScenario[]>([])
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0)
  const [references, setReferences] = useState<StudioImageArtifact[]>([])

  // Estratégia e controle de quantidade de montagens
  const strategy: StudioCompositionStrategy = "bundle"

  // Configurações gerais
  const [strength, setStrength] = useState(72)
  const [prompt, setPrompt] = useState("")
  const [tool, setTool] = useState("cursor")
  const [leftOpen, setLeftOpen] = useState(true)
  const [batchOpen, setBatchOpen] = useState(false)
  const [paintCatalogOpen, setPaintCatalogOpen] = useState(false)
  const [paintCatalogPreset, setPaintCatalogPreset] = useState<StudioPresetId>("fresh-paint")
  const paintCatalogId = useId()
  const paintPresetTrigger = useRef<HTMLButtonElement>(null)
  const [isPainting, setIsPainting] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBatchProgress, setIsBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdJobs, setCreatedJobs] = useState<CompositionJob[]>([])
  const [showResults, setShowResults] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const operationLock = useRef(false)
  const batchRequests = useRef(new Map<string, string>())
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    try {
      const ids: string[] = JSON.parse(window.localStorage.getItem(`comofica:studio-jobs:${slug}`) || "[]")
      if (Array.isArray(ids) && ids.length) {
        void Promise.all(ids.filter(id => typeof id === "string").map(async id => {
          const response = await fetch(`/api/tenant/${encodeURIComponent(slug)}/compositions/jobs/${encodeURIComponent(id)}`, { signal: controller.signal })
          return response.ok ? await response.json() as CompositionJob : null
        })).then(jobs => { if (!controller.signal.aborted) setCreatedJobs(jobs.filter((job): job is CompositionJob => Boolean(job))) }).catch(() => {})
      }
    } catch { /* A malformed local cache must not prevent editing. */ }
    return () => controller.abort()
  }, [slug])

  useEffect(() => {
    if (!createdJobs.length) return
    try { window.localStorage.setItem(`comofica:studio-jobs:${slug}`, JSON.stringify(createdJobs.map(job => job.id))) } catch { /* Results remain available in composition history. */ }
  }, [createdJobs, slug])

  // TODO: Revisit direct canvas tools when Studio supports in-place editing workflows.
  const showCanvasTools = false

  async function handleUpload(event: ChangeEvent<HTMLInputElement>, slot: "base" | "reference") {
    const files = event.target.files ? Array.from(event.target.files) : []
    event.target.value = ""
    if (files.length === 0) return
    if (operationLock.current) return
    const validation = slot === "reference"
      ? validateStudioFiles(files, references.length, slot)
      : files.map(file => validateStudioFiles([file], 0, "base")).find(Boolean)
    if (validation) {
      setError(validation)
      return
    }
    operationLock.current = true
    setIsUploading(true)

    try {
      setError(null)
      setStatusMessage(`Otimizando ${files.length} ${files.length === 1 ? "imagem" : "imagens"} para WebP...`)

      const artifacts: StudioImageArtifact[] = []
      for (const file of files) {
        const mediaUrl = await fileToOptimizedWebpDataUrl(file)
        artifacts.push({
          source: "upload",
          mediaUrl,
          caption: file.name,
          contactName: "Studio",
          createdAt: new Date().toISOString(),
        })
      }

      if (slot === "base") {
        setBaseImages((current) => {
          const updated = [...current]
          for (const art of artifacts) {
            const key = getStudioArtifactKey(art)
            if (!updated.some((item) => getStudioArtifactKey(item) === key)) {
              updated.push(art)
            }
          }
          return updated
        })
        setStatusMessage(`${files.length} ${files.length === 1 ? "cenário adicionado" : "cenários adicionados"}.`)
        return
      }

      setReferences((current) => {
        const updated = [...current]
        for (const art of artifacts) {
          const key = getStudioArtifactKey(art)
          if (!updated.some((item) => getStudioArtifactKey(item) === key)) {
            updated.push(art)
          }
        }
        return updated
      })
      setStatusMessage(`${files.length} ${files.length === 1 ? "referência adicionada" : "referências adicionadas"}.`)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Erro ao carregar imagem.")
      setStatusMessage(null)
    } finally {
      operationLock.current = false
      setIsUploading(false)
    }
  }


  // Carrega rascunho
  useEffect(() => {
    let cancelled = false
    setDraftLoaded(false)
    async function restore() {
      try {
        let draft = parseDraft(window.localStorage.getItem(storageKey))
        const saved = await loadStudioSession(slug).catch(() => undefined)
        if (saved && (!draft.updatedAt || (saved.updatedAt && saved.updatedAt >= draft.updatedAt))) {
          draft = { ...saved, baseImage: saved.base ?? undefined, baseImages: saved.baseImages ?? (saved.base ? [saved.base] : []) }
        }
        if (cancelled) return
        setBaseImages(draft.baseImages ?? (draft.baseImage ? [draft.baseImage] : []))
        setActiveBaseIndex(0)
        setActiveScenarioIndex(0)
        setScenarios(ensureStudioScenarios(draft.scenarios || [], draft.baseImages ?? (draft.baseImage ? [draft.baseImage] : []), draft.targetOutputCount))
        setReferences(draft.references ?? (draft.referenceImage ? [draft.referenceImage] : []))
        if ((draft.references?.length ?? 0) > MAX_REFERENCES) setError("Este rascunho tem mais de 5 referências. Remova as excedentes para gerar.")
        setPrompt(draft.instruction ?? "")
        setStrength(typeof draft.strength === "number" ? draft.strength : 72)
      } catch {
        if (!cancelled) setError("Não foi possível recuperar o rascunho deste navegador.")
      } finally { if (!cancelled) setDraftLoaded(true) }
    }
    void restore()
    return () => { cancelled = true }
  }, [storageKey, slug])

  // Salva rascunho
  useEffect(() => {
    if (!draftLoaded) return

    const nextDraft: StudioDraft = {
      baseImage: baseImages[0] ?? undefined,
      baseImages,
      referenceImage: references.at(-1),
      references,
      generationStrategy: strategy,
      scenarios,
      instruction: prompt,
      strength,
      updatedAt: new Date().toISOString(),
    }
    const timer = setTimeout(() => {
      void saveStudioSession(slug, {
        base: baseImages[0] ?? null, baseImages, references, instruction: prompt,
        generationStrategy: strategy, scenarios,
        strength, updatedAt: nextDraft.updatedAt,
      }).then(() => setDraftSaveError(null)).catch(() => setDraftSaveError("O navegador não conseguiu salvar o rascunho. Mantenha a página aberta."))
    }, 300)
    return () => clearTimeout(timer)
  }, [baseImages, draftLoaded, prompt, references, scenarios, slug, strategy, strength])

  useEffect(() => {
    if (draftLoaded) setScenarios(current => ensureStudioScenarios(current, baseImages))
  }, [baseImages, draftLoaded])

  const plannedCombinations = useMemo(() => planStudioScenarios(scenarios, baseImages, references), [scenarios, baseImages, references])
  const totalVariations = plannedCombinations.reduce((total, plan) => total + plan.variationCount, 0)
  const canGenerate = Boolean(draftLoaded && !isUploading && !isPainting && references.length <= MAX_REFERENCES && baseImages.length > 0 && plannedCombinations.filter(item => item.variationCount > 0).every(item => item.base && (item.base.instruction || prompt).trim()) && totalVariations > 0)

  // Cenário atualmente selecionado para preview
  const activeBaseImage = baseImages[activeBaseIndex] ?? baseImages[0] ?? null

  const currentScenarioIndex = Math.min(activeScenarioIndex, Math.max(0, plannedCombinations.length - 1))
  const currentScenario = ensureStudioScenarios(scenarios, baseImages)[currentScenarioIndex]
  const currentPlan = plannedCombinations[currentScenarioIndex]
  useEffect(() => {
    if (activeScenarioIndex === currentScenarioIndex) return
    setActiveScenarioIndex(currentScenarioIndex)
    if (currentPlan && currentPlan.baseIndex >= 0) setActiveBaseIndex(currentPlan.baseIndex)
  }, [activeScenarioIndex, currentScenarioIndex, currentPlan?.baseIndex])

  function updateActiveScenario(patch: Partial<StudioScenario>) {
    setScenarios(current => ensureStudioScenarios(current, baseImages).map((scenario, index) => index === currentScenarioIndex ? { ...scenario, ...patch } : scenario))
  }

  function clearDraft() {
    if (operationLock.current) return
    try { window.localStorage.removeItem(`comofica:studio-jobs:${slug}`) } catch { /* History is independent of the browser cache. */ }
    setBaseImages([])
    setActiveBaseIndex(0)
    setScenarios([])
    setActiveScenarioIndex(0)
    setPaintCatalogOpen(false)
    setReferences([])
    setPrompt("")
    setStrength(72)
    setCreatedJobs([])
    setError(null)
    setStatusMessage("Rascunho limpo.")
  }

  // Disparo em lote das montagens planejadas
  async function createBatchCompositions() {
    const toGenerate = expandStudioScenarioVariations(plannedCombinations)
    if (!canGenerate || isGenerating || operationLock.current) return
    operationLock.current = true

    setIsGenerating(true)
    setError(null)
    setStatusMessage(null)
    setCreatedJobs([])
    setIsBatchProgress({ current: 0, total: toGenerate.length })
    setShowResults(true)

    const newlyCreated: CompositionJob[] = []

    try {
      for (let i = 0; i < toGenerate.length; i++) {
        const item = toGenerate[i]
        if (!item.base) throw new Error(`Escolha um ambiente para o cenário ${i + 1}.`)
        setIsBatchProgress({ current: i + 1, total: toGenerate.length })
        setStatusMessage(`Enviando montagem ${i + 1} de ${toGenerate.length}: ${item.label}...`)

        const body: CompositionJobInput = {
          ...buildStudioCompositionInput(slug, item.base, item.references, item.base.instruction || prompt),
          changeStrength: strength,
        }

        const signature = JSON.stringify({ variation: item.id, body })
        if (!batchRequests.current.has(signature)) batchRequests.current.set(signature, `studio:${crypto.randomUUID()}`)
        const serialized = JSON.stringify({ ...body, sourceMessageId: batchRequests.current.get(signature) })
        if (new Blob([serialized]).size > MAX_REQUEST_BYTES) {
          throw new Error("As imagens excedem o limite de envio. Use arquivos menores ou menos referências.")
        }
        const response = await fetch(`/api/tenant/${slug}/compositions/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: serialized,
        })
        const payload = await response.json().catch(() => null) as { job?: CompositionJob; error?: string } | null

        if (!response.ok || !payload?.job) {
          throw new Error(payload?.error || `Erro ao enfileirar montagem ${i + 1}.`)
        }

        newlyCreated.push(payload.job)
        setCreatedJobs([...newlyCreated])
      }

      setCreatedJobs(newlyCreated)
      batchRequests.current.clear()
      setStatusMessage(
        `${newlyCreated.length} ${newlyCreated.length === 1 ? "composição enviada" : "composições enviadas"} para a fila com sucesso!`
      )
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro ao criar composições em lote.")
    } finally {
      operationLock.current = false
      setIsGenerating(false)
      setIsBatchProgress(null)
    }
  }

  return (
    <div className={cn(overviewStyles.surface, styles.studio)}>
      <header className={styles.header}>
        <div className={styles.title}><h1>Estúdio</h1><span>Rascunho</span></div>
        <div className={styles.actions}>
          <Button variant="ghost" type="button" disabled={isGenerating || isUploading || isPainting || !draftLoaded} onClick={clearDraft}>Descartar</Button>
          <Button variant="outline" type="button" disabled={isGenerating || isUploading || isPainting || !draftLoaded} onClick={() => void saveStudioSession(slug, { base: baseImages[0] ?? null, baseImages, references, instruction: prompt, generationStrategy: strategy, scenarios, strength, updatedAt: new Date().toISOString() }).then(() => { setDraftSaveError(null); setStatusMessage("Rascunho salvo neste navegador.") }).catch(() => setDraftSaveError("Não foi possível salvar o rascunho neste navegador."))}>Salvar rascunho</Button>
          <Button variant="default" type="button" disabled={!canGenerate || isGenerating} onClick={() => void createBatchCompositions()}>{isGenerating ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{isGenerating ? `Gerando${isBatchProgress ? ` (${isBatchProgress.current}/${isBatchProgress.total})` : ""}...` : `Gerar ${totalVariations > 1 ? `${totalVariations} composições` : "composição"}`}</Button>
          <UserMenu />
        </div>
      </header>
      {(error || draftSaveError) && <p className={styles.error} role="alert">{error || draftSaveError}</p>}
      <div className={cn(styles.workspace, !leftOpen && styles.workspaceCollapsed)}>
        <aside id="studio-tools" className={styles.inputs} hidden={!leftOpen}>
          <h2>Entradas da composição</h2>
          <UploadCollection title="Ambientes base" count={String(baseImages.length)} description="Adicione um ou mais cômodos ou ângulos para transformar." images={baseImages} onUpload={(event) => void handleUpload(event, "base")} onRemove={(index) => { setBaseImages((current) => { const updated = current.filter((_, i) => i !== index); if (activeBaseIndex >= updated.length) setActiveBaseIndex(Math.max(0, updated.length - 1)); return updated }) }} disabled={isUploading || isGenerating || isPainting || !draftLoaded} slug={slug} />
          <UploadCollection title="Referências" count={`${references.length}/${MAX_REFERENCES}`} description="Combine até 5 referências em cada ambiente." reference images={references} onUpload={(event) => void handleUpload(event, "reference")} onRemove={(index) => setReferences((current) => current.filter((_, i) => i !== index))} disabled={isUploading || isGenerating || isPainting || !draftLoaded} slug={slug} />
          <details className={cn(styles.instructions, styles.sectionAccordion)}><summary>Instruções</summary>
              {/* 4. Instrução */}
              <div>
                <Textarea
                  aria-label="Instrução da composição"
                  maxLength={4000}
                  className="w-full resize-y rounded-md border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  style={{ minHeight: 95 }}
                  placeholder="Descreva o que deseja aplicar nos ambientes..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {QUICK_TAGS.map((tag) => (
                    <Button variant="outline" type="button" key={tag} onClick={() => setPrompt((current) => current ? `${current}, ${tag}` : tag)}>
                      + {tag}
                    </Button>
                  ))}
                </div>
              </div>


          </details>
          <details className={styles.advanced}><summary>Configurações da composição</summary><div>
              {currentScenario && (
                <fieldset className="space-y-3 rounded-md border border-border p-3">
                  <legend className="px-1 text-xs font-medium">Cenários</legend>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Cenários">
                    {plannedCombinations.map((item, index) => <ToggleButton key={item.id} selected={currentScenarioIndex === index} aria-label={`Configurar cenário ${index + 1}`} onClick={() => { setActiveScenarioIndex(index); if (item.baseIndex >= 0) setActiveBaseIndex(item.baseIndex) }}>{index + 1}</ToggleButton>)}
                  </div>
                  <label className="block text-xs text-muted-foreground">
                    Ambiente desta montagem
                    <NativeSelect aria-label="Ambiente para configurar" value={currentScenario.baseKey} onChange={event => { updateActiveScenario({ baseKey: event.target.value }); const index = baseImages.findIndex(base => getStudioArtifactKey(base) === event.target.value); if (index >= 0) setActiveBaseIndex(index) }} className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm">
                      <option value="" disabled>Escolha um ambiente</option>
                      {!currentPlan?.base && currentScenario.baseKey && <option value={currentScenario.baseKey} disabled>Ambiente removido — escolha outro</option>}
                      {baseImages.map((base, index) => <option key={getStudioArtifactKey(base)} value={getStudioArtifactKey(base)}>Ambiente {index + 1} · {base.caption || "Imagem carregada"}</option>)}
                    </NativeSelect>
                  </label>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Referências</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Referências deste cenário; selecione uma ou mais">
                      {references.map((reference, index) => <Input key={getStudioArtifactKey(reference)} type="checkbox" title={formatSourceLabel(reference)} aria-label={`Referência ${index + 1}: ${formatSourceLabel(reference)}`} checked={Boolean(currentPlan?.references.includes(reference))} onChange={event => {
                        const selected = currentPlan?.references.map(item => item.mediaUrl) || []
                        updateActiveScenario({ selectedReferenceUrls: event.target.checked ? [...new Set([...selected, reference.mediaUrl])] : selected.filter(url => url !== reference.mediaUrl) })
                      }}>R{index + 1}</Input>)}
                    </div>
                  </div>
                  {references.length === 0 && <p className="text-xs text-muted-foreground">Sem produtos. Você pode transformar o ambiente apenas com instruções.</p>}
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Variações no cenário {currentScenarioIndex + 1}</p>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" type="button" aria-label="Diminuir variações deste cenário" disabled={!currentPlan?.variationCount || isGenerating} onClick={() => updateActiveScenario({ variationCount: Math.max(0, (currentPlan?.variationCount ?? 1) - 1) })}><Minus size={14} /></Button>
                      <Input type="number" aria-label="Quantidade de variações deste cenário" min={0} step={1} value={currentPlan?.variationCount ?? 1} disabled={isGenerating} onChange={event => { const value = Number(event.target.value); if (Number.isSafeInteger(value) && value >= 0) updateActiveScenario({ variationCount: value }) }} />
                      <Button variant="ghost" size="icon" type="button" aria-label="Aumentar variações deste cenário" disabled={isGenerating} onClick={() => updateActiveScenario({ variationCount: (currentPlan?.variationCount ?? 1) + 1 })}><Plus size={14} /></Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">0 deixa este cenário fora da geração. Total: {totalVariations} variações. Cada variação usa os créditos do fluxo de geração.</p>
                  </div>
                  <label className="block text-xs text-muted-foreground">
                    Instrução específica desta montagem (opcional)
                    <Textarea maxLength={4000} value={currentScenario.instruction || ""} onChange={event => updateActiveScenario({ instruction: event.target.value })} placeholder="Deixe vazio para usar a instrução geral." className="mt-1 min-h-24 w-full rounded-md border border-border bg-background p-2 text-sm" />
                  </label>
                </fieldset>
              )}

              {/* 5. Intensidade da mudança */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Intensidade da mudança
                  </span>
                  <span className="text-xs">{strength}%</span>
                </div>
                <Input
                  type="range"
                  min="0"
                  max="100"
                  value={strength}
                  onChange={(event) => setStrength(+event.target.value)}
                  className="w-full accent-primary"
                />
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Baixa intensidade deixa a alteração mais discreta. Alta intensidade deixa a mudança mais evidente, mantendo escala e perspectiva.
                </p>
              </div>

          </div></details>
        </aside>
        <section className={styles.preview} aria-label="Área de prévia">
          <div className={styles.tabs} role="group" aria-label="Visualização do ambiente">
            <ToggleButton selected={previewTab === "base"} onClick={() => setPreviewTab("base")}>Ambiente base</ToggleButton><div className={styles.previewControls}><span>{baseImages.length} ambientes · {references.length} referências</span>
            <button type="button" className={styles.toolsToggle} aria-controls="studio-tools" aria-expanded={leftOpen} aria-label={leftOpen ? "Recolher painel de ferramentas" : "Abrir painel de ferramentas"} onClick={() => setLeftOpen(open => !open)}>
              {leftOpen ? <PanelRightClose size={16} aria-hidden="true" /> : <PanelRightOpen size={16} aria-hidden="true" />}
              {leftOpen ? "Recolher ferramentas" : "Abrir ferramentas"}
            </button>
          </div></div>
          <div className={styles.canvas}>
            {previewTab === "preview" && createdJobs.length > 0 && showResults ? <div className={styles.results}><Button variant="outline" type="button" onClick={() => setShowResults(false)}>Ver preparação</Button><StudioResults slug={slug} jobs={createdJobs} onCreated={(job) => setCreatedJobs((current) => current.some((item) => item.id === job.id) ? current : [...current, job])} /></div> : activeBaseImage ? <>
              <SafeImage src={activeBaseImage.mediaUrl} alt={activeBaseImage.caption || "Ambiente base"} className={styles.baseImage} fallbackLabel="Ambiente indisponível" />
              <span className={styles.canvasLabel}>{previewTab === "base" ? `Ambiente ${activeBaseIndex + 1}` : "Preparação · imagem original, ainda sem alterações"}</span>
              <StudioPaintFlow slug={slug} base={activeBaseImage} manual={prompt} strength={strength} preset={paintCatalogPreset} catalogId={paintCatalogId} open={paintCatalogOpen} onClose={() => { setPaintCatalogOpen(false); paintPresetTrigger.current?.focus() }} disabled={isGenerating || isUploading || !draftLoaded} operationLock={operationLock} onBusy={setIsPainting} onUpdate={(key, patch) => setBaseImages(current => current.map(base => getStudioArtifactKey(base) === key ? { ...base, ...patch } : base))} />
              <div className={styles.presetBar} role="group" aria-label={`Presets do ambiente ${activeBaseIndex + 1}`}>
                {STUDIO_PRESETS.map(preset => <button key={preset.id} type="button" aria-label={preset.label} title={preset.label} aria-expanded={paintCatalogOpen && paintCatalogPreset === preset.id} aria-controls={paintCatalogId} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); setPaintCatalogOpen(false) } }} aria-pressed={paintCatalogOpen && paintCatalogPreset === preset.id} disabled={isGenerating || isUploading || isPainting || !draftLoaded} onClick={event => {
                  paintPresetTrigger.current = event.currentTarget
                  setPaintCatalogOpen(!(paintCatalogOpen && paintCatalogPreset === preset.id)); setPaintCatalogPreset(preset.id)
                }}><PresetIcon preset={preset.id} /></button>)}
              </div>
              {previewTab === "preview" && references.length > 0 && <div className={styles.previewReferences}>{(currentPlan?.baseIndex === activeBaseIndex ? currentPlan.references : getEnvironmentReferences(activeBaseImage, references)).map((image, index) => <SafeImage key={index} src={image.mediaUrl} alt={`Referência ${index + 1}`} className={styles.referenceThumb} />)}</div>}
              {previewTab === "preview" && createdJobs.length > 0 && <Button variant="outline" type="button" onClick={() => setShowResults(true)}>Ver resultados</Button>}
            </> : <div className={styles.empty}><ImageIcon size={36} /><h2>Comece adicionando um ambiente</h2><p>Envie uma foto do cômodo para preparar sua composição.</p><Button variant="outline" type="button" disabled={isUploading || isGenerating || isPainting || !draftLoaded} onClick={() => baseInput.current?.click()}><FolderOpen size={20} />Adicionar ambiente</Button><p>Depois, adicione referências e descreva o resultado desejado.</p></div>}
          </div>
          <div className={styles.batch}><h3><button type="button" className={styles.sectionToggle} aria-expanded={batchOpen} aria-controls="studio-batch-images" onClick={() => setBatchOpen(open => !open)}><ChevronRight size={14} aria-hidden="true" />Ambientes do lote <span>{baseImages.length}</span></button></h3><div id="studio-batch-images" hidden={!batchOpen} className={styles.batchImages}>{baseImages.map((image, index) => <button key={`${getStudioArtifactKey(image)}:${index}`} type="button" aria-label={`Selecionar ambiente ${index + 1}`} aria-pressed={activeBaseIndex === index} onClick={() => { setActiveBaseIndex(index); setPreviewTab("base") }}><SafeImage src={image.mediaUrl} alt={`Ambiente ${index + 1}`} className={styles.thumbnail} /><span>Ambiente {index + 1}</span></button>)}<button type="button" className={styles.addEnvironment} disabled={isUploading || isGenerating || isPainting || !draftLoaded} onClick={() => baseInput.current?.click()}><Plus size={24} /><span>Adicionar</span></button></div></div>
          <Input ref={baseInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Adicionar ambientes ao lote" onChange={(event) => void handleUpload(event, "base")} />
        </section>
      </div>
      <footer className={styles.footer} role="status">{isUploading || isGenerating ? <Loader2 size={20} className="animate-spin" /> : canGenerate ? <Check size={20} /> : <Circle size={20} />}<strong>{isUploading ? "Carregando imagens" : isGenerating ? "Gerando composição" : canGenerate ? "Pronto para gerar" : baseImages.length ? "Preparando composição" : "Aguardando arquivos"}</strong><span>{statusMessage || (baseImages.length ? "Descreva as alterações desejadas para continuar." : "Adicione pelo menos um ambiente base para continuar.")}</span>{createdJobs.length > 0 && <Link href={`/tenant/${slug}/compositions`}>Ver composições <ArrowRight size={14} /></Link>}</footer>
    </div>
  )
}
