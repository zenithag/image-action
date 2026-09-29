"use client"

import { use, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import {
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

function BaseEnvironmentCollectionCard({
  baseImages,
  activeBaseIndex,
  onSelectBase,
  onRemove,
  onUpload,
}: {
  baseImages: StudioImageArtifact[]
  activeBaseIndex: number
  onSelectBase: (index: number) => void
  onRemove: (index: number) => void
  onUpload?: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="rounded border border-border bg-card p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">
              1. Ambientes base (Cenários)
            </span>
            {baseImages.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                {baseImages.length} {baseImages.length === 1 ? "cenário" : "cenários"}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Adicione um ou mais cômodos ou ângulos que serão transformados.
          </div>
        </div>
        {baseImages.length > 0 && onUpload && (
          <label
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            title="Adicionar mais cenários"
          >
            <Plus className="mr-1 h-3 w-3" />
            Adicionar
            <input type="file" accept="image/*" multiple className="sr-only" onChange={onUpload} />
          </label>
        )}
      </div>

      {baseImages.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {baseImages.map((base, index) => {
            const isSelected = index === activeBaseIndex
            return (
              <div
                key={`${getStudioArtifactKey(base)}:${index}`}
                onClick={() => onSelectBase(index)}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded border bg-muted transition-all",
                  isSelected
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <div className="relative aspect-[4/3] w-full">
                  <SafeImage
                    src={base.mediaUrl}
                    alt={base.caption || `Cenário ${index + 1}`}
                    className="h-full w-full object-cover"
                    fallbackClassName="h-full w-full"
                    fallbackLabel="Cenário indisponível"
                  />
                  {isSelected && (
                    <div className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9.5px] font-semibold text-primary-foreground shadow">
                      Ativo no preview
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove(index)
                    }}
                    className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-foreground group-hover:opacity-100"
                    title="Remover cenário"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="border-t border-border bg-background/80 px-2 py-1.5">
                  <div className="truncate text-[10.5px] font-semibold text-foreground">
                    Cenário {index + 1}: {formatSourceLabel(base)}
                  </div>
                  {base.caption && (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {base.caption}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid min-h-36 place-items-center rounded border-[1.5px] border-dashed border-border bg-muted/40 p-5 text-center">
          <div>
            <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-[12px] font-medium text-foreground">
              Adicione um ou mais cenários base
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Envie fotos de ambientes do Inbox ou selecione várias fotos do dispositivo.
            </p>
            {onUpload && (
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Upload de cenários
                <input type="file" accept="image/*" multiple className="sr-only" onChange={onUpload} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReferenceCollectionCard({
  references,
  onRemove,
  onUpload,
}: {
  references: StudioImageArtifact[]
  onRemove: (index: number) => void
  onUpload?: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="rounded border border-border bg-card p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">
              2. Referências
            </span>
            {references.length > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-medium text-primary">
                {references.length} {references.length === 1 ? "ref." : "refs."}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Adicione até 5 referências. No modo conjunto, elas serão aplicadas juntas em cada ambiente.
          </div>
        </div>
        {references.length > 0 && onUpload && (
          <label
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            title="Adicionar mais referências"
          >
            <Plus className="mr-1 h-3 w-3" />
            Adicionar
            <input type="file" accept="image/*" multiple className="sr-only" onChange={onUpload} />
          </label>
        )}
      </div>

      {references.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {references.map((reference, index) => (
            <div key={`${getStudioArtifactKey(reference)}:${index}`} className="overflow-hidden rounded border border-border bg-muted">
              <div className="relative">
                <SafeImage
                  src={reference.mediaUrl}
                  alt={reference.caption || "Referencia"}
                  className="aspect-square w-full object-cover"
                  fallbackClassName="aspect-square w-full"
                  fallbackLabel="Referencia indisponivel"
                  fallbackHint="Remova e adicione novamente."
                />
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute right-1.5 top-1.5 rounded bg-accent p-1.5 text-muted-foreground hover:text-foreground"
                  title="Remover referencia"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="border-t border-border bg-background/80 px-2 py-1.5">
                <div className="truncate text-[10.5px] font-semibold text-foreground">
                  Ref. {index + 1} · {formatSourceLabel(reference)}
                </div>
                {reference.catalogCategory && (
                  <div className="mt-0.5 truncate text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {reference.catalogCategory}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid min-h-36 place-items-center rounded border-[1.5px] border-dashed border-border bg-muted/40 p-5 text-center">
          <div>
            <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-[12px] font-medium text-foreground">
              Adicione uma ou mais referencias
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Use imagens do Inbox, selecione múltiplos arquivos ou busque por SKU.
            </p>
            {onUpload && (
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Upload de referências
                <input type="file" accept="image/*" multiple className="sr-only" onChange={onUpload} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

type PlannedComposition = {
  id: string
  baseIndex: number
  base: StudioImageArtifact
  references: StudioImageArtifact[]
  label: string
}

const CANVAS_TOOLS = [
  { id: "cursor", icon: MousePointer2, label: "Selecionar" },
  { id: "brush", icon: Paintbrush, label: "Pincel" },
  { id: "erase", icon: Eraser, label: "Apagar" },
  { id: "layer", icon: Layers, label: "Camadas" },
  { id: "magic", icon: Sparkles, label: "Selecao IA" },
] as const

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
    <div className="flex h-full flex-col">
      {/* Top Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-7">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              NOVO
            </div>
            <div className="font-display text-xl font-semibold leading-tight tracking-tight">
              Estudio
            </div>
          </div>
          {maxAvailable > 1 && (
            <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Modo Lote ({effectiveTargetCount} de {maxAvailable} {maxAvailable === 1 ? "montagem" : "montagens"})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearDraft}
            className="rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted"
          >
            Descartar
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium hover:border-muted-foreground/30"
            disabled={!draftLoaded || isUploading || isGenerating}
            onClick={() => void saveStudioSession(slug, { base: baseImages[0] ?? null, baseImages, references, instruction: prompt, generationStrategy: strategy, targetOutputCount: targetOutputCount ?? undefined, strength, updatedAt: new Date().toISOString() }).then(() => { setDraftSaveError(null); setStatusMessage("Rascunho salvo neste navegador.") }).catch(() => setDraftSaveError("Não foi possível salvar o rascunho neste navegador."))}
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={createBatchCompositions}
            disabled={!canGenerate || isGenerating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>
                  {isBatchProgress
                    ? `Gerando (${isBatchProgress.current}/${isBatchProgress.total})...`
                    : "Gerando..."}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  Gerar {effectiveTargetCount > 1 ? `${effectiveTargetCount} composições` : "composição"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feedback Bar */}
      {(error || draftSaveError || statusMessage || createdJobs.length > 0) && (
        <div className={cn(
          "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-5 py-2 text-xs",
          error
            ? "border-destructive/20 bg-destructive/10 text-destructive"
            : "border-primary/20 bg-primary/10 text-primary"
        )}>
          <div className="flex items-center gap-2">
            {isGenerating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span role={error || draftSaveError ? "alert" : "status"}>{error || draftSaveError || statusMessage}</span>
          </div>
          {createdJobs.length > 0 && (
            <button
              type="button"
              onClick={() => router.push(`/tenant/${slug}/compositions`)}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              Ver {createdJobs.length} {createdJobs.length === 1 ? "composição na fila" : "composições na fila"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div
        className="grid flex-1 overflow-hidden bg-muted/30"
        style={{
          gridTemplateColumns: `${leftOpen ? "minmax(280px, 340px)" : "44px"} minmax(0, 1fr)`,
          transition: "grid-template-columns 0.2s",
        }}
      >
        {/* Left Sidebar */}
        {!leftOpen ? (
          <div className="flex flex-col items-center border-r border-border bg-background pt-3">
            <button
              onClick={() => setLeftOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Expandir"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div
              className="mt-5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Entradas & Lote
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col overflow-hidden border-r border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Entradas & Lote
              </span>
              <button
                onClick={() => setLeftOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Recolher"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 scrollbar-hide">
              {/* 1. Ambientes base (Cenários) */}
              <BaseEnvironmentCollectionCard
                baseImages={baseImages}
                activeBaseIndex={activeBaseIndex}
                onSelectBase={(index) => setActiveBaseIndex(index)}
                onRemove={(index) => {
                  setBaseImages((current) => {
                    const updated = current.filter((_, i) => i !== index)
                    if (activeBaseIndex >= updated.length) {
                      setActiveBaseIndex(Math.max(0, updated.length - 1))
                    }
                    return updated
                  })
                }}
                onUpload={(event) => void handleUpload(event, "base")}
              />

              {/* 2. Referências */}
              <ReferenceCollectionCard
                references={references}
                onRemove={(index) => setReferences((current) => current.filter((_, i) => i !== index))}
                onUpload={(event) => void handleUpload(event, "reference")}
              />

              {/* Buscar referência por SKU */}
              <div className="rounded border border-border bg-card p-2.5">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Buscar referência por SKU
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void searchReferenceBySku()
                  }}
                >
                  <input
                    value={skuQuery}
                    onChange={(event) => setSkuQuery(event.target.value)}
                    placeholder="Ex: REV-MOSAICO..."
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={!skuQuery.trim() || isSearchingSku}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSearchingSku ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                    Buscar
                  </button>
                </form>
                {skuStatus && (
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    {skuStatus}
                  </p>
                )}
              </div>

              {/* 3. Configuração das Montagens (Estratégia & Quantidade de Entradas) */}
              {(baseImages.length > 0 || references.length > 0) && (
                <div className="rounded border border-border bg-card p-2.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-foreground">
                      3. Configuração das Montagens
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

              {/* 4. Instrução */}
              <div>
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  4. Instrução geral
                </div>
                <textarea
                  aria-label="Instrução da composição"
                  maxLength={4000}
                  className="w-full resize-y rounded border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  style={{ minHeight: 95 }}
                  placeholder="Ex: aplique o revestimento da referencia na parede do fundo, mantendo moveis, portas, janelas e iluminacao natural."
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
                    Intensidade da mudanca
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
            </div>

            <div className="border-t border-border bg-muted/50 px-4 py-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Processamento</span>
                <span className="font-mono">fila do usuário</span>
              </div>
            </div>
          </div>
        )}

        {/* Right Canvas / Preview Area */}
        <div className="flex flex-col overflow-hidden bg-muted/30 p-5">
          {showCanvasTools && (
            <div className="mb-3.5 flex items-center gap-0.5 self-center rounded border border-border bg-card p-1">
              {CANVAS_TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(item.id)}
                  title={item.label}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-lg transition-colors",
                    tool === item.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          )}

          {/* Central Split View: Base Image & Preview */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Base Image Box */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Ambiente Base ({baseImages.length > 0 ? `${activeBaseIndex + 1} de ${baseImages.length}` : "Nenhum"})
                </span>
                {baseImages.length > 1 && (
                  <div className="flex items-center gap-1">
                    {baseImages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveBaseIndex(idx)}
                        className={cn(
                          "rounded px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                          idx === activeBaseIndex
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Cenário {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative flex-1 overflow-hidden rounded border border-border bg-card">
                {activeBaseImage ? (
                  <SafeImage
                    src={activeBaseImage.mediaUrl}
                    alt={activeBaseImage.caption || "Ambiente base"}
                    className="h-full w-full object-contain"
                    fallbackClassName="h-full w-full"
                    fallbackLabel="Ambiente indisponivel"
                    fallbackHint="Volte ao Inbox e envie novamente."
                  />
                ) : (
                  <div className="grid h-full min-h-72 place-items-center text-center">
                    <div className="px-6">
                      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Nenhum ambiente base selecionado</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Adicione um ou mais ambientes no painel lateral esquerdo.
                      </p>
                    </div>
                  </div>
                )}
                {activeBaseImage && (
                  <div className="absolute left-3 top-3 rounded bg-accent px-2.5 py-1 text-[10.5px] font-semibold">
                    Cenário {activeBaseIndex + 1} ({formatSourceLabel(activeBaseImage)})
                  </div>
                )}
              </div>
            </div>

            {/* Preview Box */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {createdJobs.length && showResults ? "Resultados da composição" : "Preparação da composição"}
                </span>
                <div className="flex items-center gap-1.5">
                  {createdJobs.length > 0 && <button type="button" onClick={() => setShowResults(value => !value)} className="rounded border border-border px-2 py-1 text-xs">{showResults ? "Ver preparação" : "Ver resultados"}</button>}
                  {effectiveTargetCount > 1 ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Lote: {effectiveTargetCount} montagens
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Rascunho
                    </span>
                  )}
                </div>
              </div>

              {createdJobs.length > 0 && showResults ? <StudioResults slug={slug} jobs={createdJobs} onCreated={job => setCreatedJobs(current => current.some(item => item.id === job.id) ? current : [...current, job])} /> : <div className="relative flex-1 overflow-hidden rounded border border-primary/20 bg-card">
                {activeBaseImage ? (
                  <>
                    <SafeImage
                      src={activeBaseImage.mediaUrl}
                      alt="Ambiente original, ainda sem alterações"
                      className="h-full w-full object-contain opacity-95"
                      fallbackClassName="h-full w-full"
                      fallbackLabel="Pre-visualizacao indisponivel"
                    />
                    <div className="absolute inset-0 bg-primary/5 pointer-events-none" />

                    {/* Miniaturas de referências sobrepostas no canto superior */}
                    {references.length > 0 && (
                      <div className="absolute right-3 top-3 flex max-w-[65%] gap-1.5 overflow-hidden rounded border border-border bg-background/90 p-1.5 shadow-sm">
                        {references.slice(0, 4).map((reference, index) => (
                          <div key={`${getStudioArtifactKey(reference)}:preview:${index}`} className="relative h-12 w-12 overflow-hidden rounded-md bg-muted">
                            <SafeImage
                              src={reference.mediaUrl}
                              alt="Referencia"
                              className="h-full w-full object-cover"
                              fallbackClassName="h-full w-full"
                              fallbackLabel="Ref."
                            />
                          </div>
                        ))}
                        {references.length > 4 && (
                          <div className="grid h-12 w-12 place-items-center rounded-md bg-muted text-xs font-semibold">
                            +{references.length - 4}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Barra de ação inferior */}
                    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded bg-accent px-2.5 py-1 text-[10.5px] font-semibold">
                        <Sparkles className="h-3 w-3" />
                        {effectiveTargetCount > 1
                          ? `${effectiveTargetCount} composições prontas para gerar`
                          : canGenerate ? "Preparação · imagem original" : "Preencha as instruções para gerar"}
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => void createBatchCompositions()}
                        disabled={!canGenerate || isGenerating}
                        className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            <span>Gerar {effectiveTargetCount > 1 ? `${effectiveTargetCount} montagens` : "montagem"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid h-full min-h-72 place-items-center text-center text-muted-foreground">
                    <p className="max-w-xs px-6 text-sm">
                      A pré-visualização aparecerá assim que você carregar ao menos um ambiente base.
                    </p>
                  </div>
                )}
              </div>}
            </div>
          </div>

          {/* Histórico / Galeria das entradas selecionadas */}
          <div className="mt-4 flex items-center gap-2.5">
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Entradas ({baseImages.length} {baseImages.length === 1 ? "cenário" : "cenários"}, {references.length} {references.length === 1 ? "ref" : "refs"})
            </span>
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide">
              {baseImages.map((image, index) => (
                <div
                  key={`base-thumb:${index}`}
                  onClick={() => setActiveBaseIndex(index)}
                  className={cn(
                    "group relative aspect-[4/3] w-16 shrink-0 cursor-pointer overflow-hidden rounded border transition-all",
                    index === activeBaseIndex ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/40"
                  )}
                  title={`Cenário ${index + 1}`}
                >
                  <SafeImage src={image.mediaUrl} alt={`Cenário ${index + 1}`} className="h-full w-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-background/80 px-1 py-0.5 text-[8.5px] font-bold text-center">
                    Cen {index + 1}
                  </div>
                </div>
              ))}
              {references.map((image, index) => (
                <div
                  key={`ref-thumb:${index}`}
                  className="relative aspect-square w-16 shrink-0 overflow-hidden rounded border border-border bg-muted"
                  title={image.catalogItemName || `Referência ${index + 1}`}
                >
                  <SafeImage src={image.mediaUrl} alt="Referência" className="h-full w-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-background/80 px-1 py-0.5 text-[8.5px] font-bold text-center truncate">
                    Ref {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
