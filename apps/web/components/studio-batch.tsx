"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import Link from "next/link"
import styles from "./studio-batch.module.css"
import overviewStyles from "./tenant-overview.module.css"
import { useRouter } from "next/navigation"
import {
  FolderOpen, Search, Circle,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Eraser,
  Image as ImageIcon,
  Layers,
  Loader2,
  Minus,
  MousePointer2,
  Paintbrush,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { SafeImage } from "@/components/safe-image"
import { StudioResults } from "@/components/studio-results"
import type { CatalogItem } from "@/lib/catalog-types"
import type { CompositionJob, CompositionJobInput } from "@/lib/composition-types"
import type {
  StudioCompositionStrategy,
  StudioDraft,
  StudioImageArtifact,
} from "@/lib/studio-draft"
import {
  getStudioArtifactKey,
  getStudioDraftStorageKey,
} from "@/lib/studio-draft"
import { cn } from "@/lib/utils"
import { buildStudioInput, getEnvironmentReferences, IMAGE_TYPES, MAX_REFERENCES, MAX_REQUEST_BYTES, MAX_UPLOAD_BYTES, validateStudioFiles } from "@/lib/studio-v1"
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

function normalizeSku(value: string | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
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
  return <section className={styles.inputSection}>
    <h3>{title}<span>{count}</span></h3><p>{description}</p>
    <div className={styles.dropzone}>
      <ImageIcon size={27} aria-hidden="true" /><strong>{reference ? "Adicionar referências" : "Adicione fotos do ambiente"}</strong><p>{reference ? "Selecione imagens do seu dispositivo." : "ou selecione arquivos do seu dispositivo."}</p>
      <button type="button" onClick={() => input.current?.click()} disabled={disabled}><FolderOpen size={16} />Selecionar arquivos</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label={reference ? "Selecionar referências" : "Selecionar ambientes"} disabled={disabled} onChange={onUpload} />
    </div>
    {images.length > 0 && <div className={styles.uploaded}>{images.map((image, index) => <div key={`${getStudioArtifactKey(image)}:${index}`}><SafeImage src={image.mediaUrl} alt={image.caption || `${title} ${index + 1}`} className={styles.thumbnail} /><button type="button" aria-label={`Remover ${reference ? "referência" : "ambiente"} ${index + 1}`} disabled={disabled} onClick={() => onRemove(index)}><X size={14} /></button></div>)}</div>}
    {reference && <p>As referências selecionadas serão aplicadas juntas em cada ambiente.</p>}
  </section>
}

type PlannedComposition = {
  id: string
  baseIndex: number
  base: StudioImageArtifact
  references: StudioImageArtifact[]
  label: string
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
  const [references, setReferences] = useState<StudioImageArtifact[]>([])

  // Estratégia e controle de quantidade de montagens
  const strategy: StudioCompositionStrategy = "bundle"
  const [targetOutputCount, setTargetOutputCount] = useState<number | null>(null)

  // Configurações gerais
  const [strength, setStrength] = useState(72)
  const [prompt, setPrompt] = useState("")
  const [tool, setTool] = useState("cursor")
  const [leftOpen, setLeftOpen] = useState(true)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isBatchProgress, setIsBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [isSearchingSku, setIsSearchingSku] = useState(false)
  const [skuQuery, setSkuQuery] = useState("")
  const [skuStatus, setSkuStatus] = useState<string | null>(null)
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

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      if (w < 1000) {
        setLeftOpen(false)
      }
    }
    window.addEventListener("resize", check)
    check()
    return () => window.removeEventListener("resize", check)
  }, [])

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
        setReferences(draft.references ?? (draft.referenceImage ? [draft.referenceImage] : []))
        if ((draft.references?.length ?? 0) > MAX_REFERENCES) setError("Este rascunho tem mais de 5 referências. Remova as excedentes para gerar.")
        // Legacy matrix drafts now produce one composition per environment.
        setTargetOutputCount(typeof draft.targetOutputCount === "number" ? draft.targetOutputCount : null)
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
      targetOutputCount: targetOutputCount ?? undefined,
      instruction: prompt,
      strength,
      updatedAt: new Date().toISOString(),
    }
    const timer = setTimeout(() => {
      void saveStudioSession(slug, {
        base: baseImages[0] ?? null, baseImages, references, instruction: prompt,
        generationStrategy: strategy, targetOutputCount: targetOutputCount ?? undefined,
        strength, updatedAt: nextDraft.updatedAt,
      }).then(() => setDraftSaveError(null)).catch(() => setDraftSaveError("O navegador não conseguiu salvar o rascunho. Mantenha a página aberta."))
    }, 300)
    return () => clearTimeout(timer)
  }, [baseImages, draftLoaded, prompt, references, slug, strategy, strength, targetOutputCount])

  // Cálculo das combinações planejadas
  const plannedCombinations: PlannedComposition[] = useMemo(() => {
    if (baseImages.length === 0) return []

    // Caso 1: Modo pacote (todas as referências juntas em cada cenário) ou apenas 1 referência/nenhuma
    {
      return baseImages.map((base, bIdx) => ({
        id: `bundle:${bIdx}`,
        baseIndex: bIdx,
        base,
        references: getEnvironmentReferences(base, references),
        label: `Cenário ${bIdx + 1} + ${getEnvironmentReferences(base, references).length} referência(s) → 1 composição`,
      }))
    }

  }, [baseImages, references, strategy])

  const maxAvailable = plannedCombinations.length
  const effectiveTargetCount = targetOutputCount !== null
    ? Math.max(1, Math.min(targetOutputCount, maxAvailable || 1))
    : maxAvailable

  const canGenerate = Boolean(draftLoaded && !isUploading && !isSearchingSku && references.length <= MAX_REFERENCES && baseImages.length > 0 && plannedCombinations.slice(0, effectiveTargetCount).every(item => (item.base.instruction || prompt).trim()) && effectiveTargetCount > 0)

  // Cenário atualmente selecionado para preview
  const activeBaseImage = baseImages[activeBaseIndex] ?? baseImages[0] ?? null

  function updateActiveEnvironment(patch: Partial<StudioImageArtifact>) {
    if (!activeBaseImage) return
    setBaseImages(current => current.map(base => base === activeBaseImage ? { ...base, ...patch } : base))
  }

  function clearDraft() {
    if (operationLock.current) return
    try { window.localStorage.removeItem(`comofica:studio-jobs:${slug}`) } catch { /* History is independent of the browser cache. */ }
    setBaseImages([])
    setActiveBaseIndex(0)
    setReferences([])
    setPrompt("")
    setStrength(72)
    setTargetOutputCount(null)
    setCreatedJobs([])
    setError(null)
    setStatusMessage("Rascunho limpo.")
  }

  async function searchReferenceBySku() {
    const normalizedQuery = normalizeSku(skuQuery)
    if (!normalizedQuery || isSearchingSku || operationLock.current) return
    if (references.length >= MAX_REFERENCES) {
      setSkuStatus("Você já tem 5 referências. Remova uma para adicionar outro produto.")
      return
    }
    operationLock.current = true

    setIsSearchingSku(true)
    setSkuStatus(null)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${slug}/catalog/items`, { cache: "no-store" })
      const items = await response.json().catch(() => null) as CatalogItem[] | { error?: string } | null

      if (!response.ok || !Array.isArray(items)) {
        throw new Error("Nao foi possivel buscar o catalogo.")
      }

      const item = items.find((catalogItem) => normalizeSku(catalogItem.sku) === normalizedQuery)
        ?? items.find((catalogItem) => normalizeSku(catalogItem.sku).includes(normalizedQuery))

      if (!item) {
        setSkuStatus("Nenhum produto encontrado com esse SKU.")
        return
      }

      const reference: StudioImageArtifact = {
        source: "catalog",
        catalogItemId: item.id,
        catalogItemName: item.name,
        catalogSku: item.sku,
        catalogCategory: item.category,
        catalogDescription: item.description,
        mediaUrl: `/api/tenant/${slug}/catalog/items/${encodeURIComponent(item.id)}/image`,
        caption: item.sku ? `${item.name} - SKU ${item.sku}` : item.name,
        createdAt: new Date().toISOString(),
      }

      setReferences((current) => {
        const key = getStudioArtifactKey(reference)
        if (current.some((ref) => getStudioArtifactKey(ref) === key)) return current
        return [...current, reference]
      })
      setSkuStatus(`Referencia adicionada: ${item.name}${item.sku ? ` (${item.sku})` : ""}.`)
    } catch (searchError) {
      setSkuStatus(searchError instanceof Error ? searchError.message : "Erro ao buscar SKU.")
    } finally {
      operationLock.current = false
      setIsSearchingSku(false)
    }
  }

  // Disparo em lote das montagens planejadas
  async function createBatchCompositions() {
    const toGenerate = plannedCombinations.slice(0, effectiveTargetCount)
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
        setIsBatchProgress({ current: i + 1, total: toGenerate.length })
        setStatusMessage(`Enviando montagem ${i + 1} de ${toGenerate.length}: ${item.label}...`)

        const body: CompositionJobInput = {
          ...buildStudioInput(slug, item.base, item.references, item.base.instruction || prompt),
          changeStrength: strength,
        }

        const signature = JSON.stringify(body)
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
        <div><div className={styles.title}><h1>Estúdio</h1><span>Rascunho</span></div><p>Prepare os ambientes e as referências da composição.</p></div>
        <div className={styles.actions}>
          <button type="button" disabled={isGenerating || isUploading || !draftLoaded} onClick={clearDraft}>Descartar</button>
          <button type="button" disabled={isGenerating || isUploading || !draftLoaded} className={styles.save} onClick={() => void saveStudioSession(slug, { base: baseImages[0] ?? null, baseImages, references, instruction: prompt, generationStrategy: strategy, targetOutputCount: targetOutputCount ?? undefined, strength, updatedAt: new Date().toISOString() }).then(() => { setDraftSaveError(null); setStatusMessage("Rascunho salvo neste navegador.") }).catch(() => setDraftSaveError("Não foi possível salvar o rascunho neste navegador."))}>Salvar rascunho</button>
          <button type="button" className={styles.generate} disabled={!canGenerate || isGenerating} onClick={() => void createBatchCompositions()}>{isGenerating ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{isGenerating ? `Gerando${isBatchProgress ? ` (${isBatchProgress.current}/${isBatchProgress.total})` : ""}...` : `Gerar ${effectiveTargetCount > 1 ? `${effectiveTargetCount} composições` : "composição"}`}</button>
        </div>
      </header>
      {(error || draftSaveError) && <p className={styles.error} role="alert">{error || draftSaveError}</p>}
      <div className={styles.workspace}>
        <aside className={styles.inputs}>
          <h2>Entradas da composição</h2>
          <UploadCollection title="Ambientes base" count={String(baseImages.length)} description="Adicione um ou mais cômodos ou ângulos para transformar." images={baseImages} onUpload={(event) => void handleUpload(event, "base")} onRemove={(index) => { setBaseImages((current) => { const updated = current.filter((_, i) => i !== index); if (activeBaseIndex >= updated.length) setActiveBaseIndex(Math.max(0, updated.length - 1)); return updated }) }} disabled={isUploading || isGenerating || !draftLoaded} slug={slug} />
          <UploadCollection title="Referências" count={`${references.length}/${MAX_REFERENCES}`} description="Combine até 5 referências em cada ambiente." reference images={references} onUpload={(event) => void handleUpload(event, "reference")} onRemove={(index) => setReferences((current) => current.filter((_, i) => i !== index))} disabled={isUploading || isGenerating || !draftLoaded} slug={slug} />
          <section className={styles.sku}><h3>Buscar por SKU</h3><form onSubmit={(event) => { event.preventDefault(); void searchReferenceBySku() }}><input aria-label="SKU do produto" value={skuQuery} onChange={(event) => setSkuQuery(event.target.value)} placeholder="Digite o SKU do produto" /><button type="submit" aria-label="Buscar produto por SKU" disabled={!skuQuery.trim() || isSearchingSku || isGenerating}>{isSearchingSku ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}</button></form>{skuStatus && <p role="status">{skuStatus}</p>}</section>
          <div className={styles.instructions}>
              {/* 4. Instrução */}
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Instruções
                </div>
                <textarea
                  aria-label="Instrução da composição"
                  maxLength={4000}
                  className="w-full resize-y rounded border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  style={{ minHeight: 95 }}
                  placeholder="Descreva o que deseja aplicar nos ambientes..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setPrompt((current) => current ? `${current}, ${tag}` : tag)}
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>


          </div>
          <details className={styles.advanced}><summary>Configurações da composição</summary><div>
              {/* Configuração do lote (Estratégia & Quantidade de Entradas) */}
              {(baseImages.length > 0 || references.length > 0) && (
                <div className="rounded border border-border bg-card p-2.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-foreground">
                      Configuração do lote
                    </span>
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                      {maxAvailable} {maxAvailable === 1 ? "combinação" : "combinações"}
                    </span>
                  </div>

                  {/* Modo de Combinação */}
                  <div>
                    <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                      Uma composição por foto
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Os produtos escolhidos para cada foto são aplicados juntos na mesma imagem. Tentar novamente reprocessa apenas a composição escolhida.
                    </p>
                  </div>

                  {/* Seletor de Quantidade de Composições a Gerar */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-muted-foreground">
                        Quantidade a gerar:
                      </span>
                      <span className="font-semibold text-foreground">
                        {effectiveTargetCount} de {maxAvailable}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetOutputCount((prev) => Math.max(1, (prev ?? maxAvailable) - 1))}
                        disabled={effectiveTargetCount <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40"
                        title="Diminuir quantidade"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <input
                        type="number"
                        min={1}
                        max={maxAvailable || 1}
                        value={effectiveTargetCount}
                        onChange={(event) => {
                          const val = parseInt(event.target.value, 10)
                          if (!isNaN(val)) {
                            setTargetOutputCount(Math.max(1, Math.min(val, maxAvailable || 1)))
                          }
                        }}
                        className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-center text-xs font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />

                      <button
                        type="button"
                        onClick={() => setTargetOutputCount((prev) => Math.min(maxAvailable, (prev ?? maxAvailable) + 1))}
                        disabled={effectiveTargetCount >= maxAvailable}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40"
                        title="Aumentar quantidade"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Presets rápidos */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {[1, 2, 4, maxAvailable]
                        .filter((val, idx, arr) => val > 0 && val <= maxAvailable && arr.indexOf(val) === idx)
                        .map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setTargetOutputCount(val === maxAvailable ? null : val)}
                            className={cn(
                              "rounded border px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                              effectiveTargetCount === val
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {val === maxAvailable ? `Todas (${maxAvailable})` : `${val} ${val === 1 ? "montagem" : "montagens"}`}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Prévia da lista planejada */}
                  <div className="rounded border border-border/70 bg-muted/30 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Resumo da fila:
                    </div>
                    <ul className="space-y-1 text-[10.5px] text-muted-foreground">
                      {plannedCombinations.slice(0, effectiveTargetCount).map((item, idx) => (
                        <li key={item.id} className="flex items-center gap-1.5 truncate">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground">
                            {idx + 1}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </li>
                      ))}
                      {effectiveTargetCount < maxAvailable && (
                        <li className="text-[10px] italic text-muted-foreground">
                          + {maxAvailable - effectiveTargetCount} combinação(ões) ignoradas pelo limite
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {activeBaseImage && (
                <fieldset className="space-y-3 rounded border border-border p-3">
                  <legend className="px-1 text-sm font-medium">Configurar cenário {activeBaseIndex + 1}</legend>
                  <label className="block text-xs text-muted-foreground">
                    Ambiente
                    <select aria-label="Ambiente para configurar" value={activeBaseIndex} onChange={event => setActiveBaseIndex(Number(event.target.value))} className="mt-1 w-full rounded border border-border bg-background p-2 text-sm">
                      {baseImages.map((base, index) => <option key={index} value={index}>Cenário {index + 1} · {base.caption || "Ambiente"}</option>)}
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">Escolha os produtos desta foto. Todos os marcados entram em uma única composição.</p>
                  {references.map((reference, index) => (
                    <label key={getStudioArtifactKey(reference)} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={getEnvironmentReferences(activeBaseImage, references).includes(reference)} onChange={event => {
                        const selected = getEnvironmentReferences(activeBaseImage, references).map(item => item.mediaUrl)
                        updateActiveEnvironment({ selectedReferenceUrls: event.target.checked ? [...selected, reference.mediaUrl] : selected.filter(url => url !== reference.mediaUrl) })
                      }} />
                      <span className="min-w-0 break-words">Ref. {index + 1} · {formatSourceLabel(reference)}</span>
                    </label>
                  ))}
                  {references.length === 0 && <p className="text-xs text-muted-foreground">Sem produtos. Você pode transformar o ambiente apenas com instruções.</p>}
                  <label className="block text-xs text-muted-foreground">
                    Instrução específica desta foto (opcional)
                    <textarea maxLength={4000} value={activeBaseImage.instruction || ""} onChange={event => updateActiveEnvironment({ instruction: event.target.value })} placeholder="Deixe vazio para usar a instrução geral." className="mt-1 min-h-24 w-full rounded border border-border bg-background p-2 text-sm" />
                  </label>
                </fieldset>
              )}

              {/* 5. Intensidade da mudança */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Intensidade da mudança
                  </span>
                  <span className="font-mono text-xs">{strength}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={strength}
                  onChange={(event) => setStrength(+event.target.value)}
                  className="w-full accent-primary"
                />
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Baixa intensidade deixa a alteração mais discreta. Alta intensidade deixa a mudança mais evidente, mantendo escala e perspectiva.
                </p>
              </div>

          </div></details>
        </aside>
        <section className={styles.preview} aria-label="Área de prévia">
          <div className={styles.tabs} role="group" aria-label="Visualização do ambiente"><button type="button" aria-pressed={previewTab === "base"} onClick={() => setPreviewTab("base")}>Ambiente base</button><button type="button" aria-pressed={previewTab === "preview"} onClick={() => setPreviewTab("preview")}>Prévia da composição</button><span>{baseImages.length} ambientes · {references.length} referências</span></div>
          <div className={styles.canvas}>
            {previewTab === "preview" && createdJobs.length > 0 && showResults ? <div className={styles.results}><button type="button" className={styles.backToPreparation} onClick={() => setShowResults(false)}>Ver preparação</button><StudioResults slug={slug} jobs={createdJobs} onCreated={(job) => setCreatedJobs((current) => current.some((item) => item.id === job.id) ? current : [...current, job])} /></div> : activeBaseImage ? <>
              <SafeImage src={activeBaseImage.mediaUrl} alt={activeBaseImage.caption || "Ambiente base"} className={styles.baseImage} fallbackLabel="Ambiente indisponível" />
              <span className={styles.canvasLabel}>{previewTab === "base" ? `Ambiente ${activeBaseIndex + 1}` : "Preparação · imagem original, ainda sem alterações"}</span>
              {previewTab === "preview" && references.length > 0 && <div className={styles.previewReferences}>{getEnvironmentReferences(activeBaseImage, references).map((image, index) => <SafeImage key={index} src={image.mediaUrl} alt={`Referência ${index + 1}`} className={styles.referenceThumb} />)}</div>}
              {previewTab === "preview" && createdJobs.length > 0 && <button type="button" className={styles.resultToggle} onClick={() => setShowResults(true)}>Ver resultados</button>}
            </> : <div className={styles.empty}><ImageIcon size={36} /><h2>Comece adicionando um ambiente</h2><p>Envie uma foto do cômodo para preparar sua composição.</p><button type="button" disabled={isUploading || isGenerating || !draftLoaded} onClick={() => baseInput.current?.click()}><FolderOpen size={20} />Adicionar ambiente</button><p>Depois, adicione referências e descreva o resultado desejado.</p></div>}
          </div>
          <div className={styles.batch}><h3>Ambientes do lote <span>{baseImages.length}</span></h3><div className={styles.batchImages}>{baseImages.map((image, index) => <button key={`${getStudioArtifactKey(image)}:${index}`} type="button" aria-label={`Selecionar ambiente ${index + 1}`} aria-pressed={activeBaseIndex === index} onClick={() => { setActiveBaseIndex(index); setPreviewTab("base") }}><SafeImage src={image.mediaUrl} alt={`Ambiente ${index + 1}`} className={styles.thumbnail} /><span>Ambiente {index + 1}</span></button>)}<button type="button" className={styles.addEnvironment} disabled={isUploading || isGenerating || !draftLoaded} onClick={() => baseInput.current?.click()}><Plus size={24} /><span>Adicionar</span></button></div></div>
          <input ref={baseInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Adicionar ambientes ao lote" onChange={(event) => void handleUpload(event, "base")} />
        </section>
      </div>
      <footer className={styles.footer} role="status">{isUploading || isGenerating ? <Loader2 size={20} className="animate-spin" /> : canGenerate ? <Check size={20} /> : <Circle size={20} />}<strong>{isUploading ? "Carregando imagens" : isGenerating ? "Gerando composição" : canGenerate ? "Pronto para gerar" : baseImages.length ? "Preparando composição" : "Aguardando arquivos"}</strong><span>{statusMessage || (baseImages.length ? "Descreva as alterações desejadas para continuar." : "Adicione pelo menos um ambiente base para continuar.")}</span>{createdJobs.length > 0 && <Link href={`/tenant/${slug}/compositions`}>Ver composições <ArrowRight size={14} /></Link>}</footer>
    </div>
  )
}
