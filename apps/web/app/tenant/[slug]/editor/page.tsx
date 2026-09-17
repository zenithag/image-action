"use client"

import { use, useEffect, useMemo, useState } from "react"
import type { ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ChevronRight,
  Eraser,
  Image as ImageIcon,
  Layers,
  Loader2,
  MousePointer2,
  Paintbrush,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { SafeImage } from "@/components/safe-image"
import type { CatalogItem } from "@/lib/catalog-types"
import type { CompositionJob, CompositionJobInput } from "@/lib/composition-types"
import type { StudioDraft, StudioImageArtifact } from "@/lib/studio-draft"
import { getStudioDraftStorageKey } from "@/lib/studio-draft"
import { cn } from "@/lib/utils"

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

function getReferenceKey(reference: StudioImageArtifact) {
  if (reference.source === "catalog" && reference.catalogItemId) return `catalog:${reference.catalogItemId}`
  if (reference.source === "catalog" && reference.catalogSku) return `catalog-sku:${normalizeSku(reference.catalogSku)}`
  if (reference.source === "inbox" && reference.messageId) return `inbox:${reference.messageId}`
  if (reference.source === "upload") return `upload:${reference.mediaUrl.slice(0, 80)}`
  return `${reference.source}:${reference.mediaUrl}`
}

function mergeReferences(current: StudioImageArtifact[], nextReference: StudioImageArtifact) {
  const nextKey = getReferenceKey(nextReference)
  const alreadyExists = current.some((reference) => getReferenceKey(reference) === nextKey)

  return alreadyExists ? current : [...current, nextReference]
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
  if (!file.type.startsWith("image/") || file.type.includes("svg")) {
    throw new Error("Selecione uma imagem raster valida.")
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

function ImageSlotCard({
  title,
  description,
  image,
  onClear,
  onUpload,
}: {
  title: string
  description: string
  image: StudioImageArtifact | null
  onClear: () => void
  onUpload?: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="rounded border border-border bg-card p-2.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-foreground">{title}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</div>
        </div>
        {image && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Remover imagem"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {image ? (
        <div className="overflow-hidden rounded border border-border bg-muted">
          <SafeImage
            src={image.mediaUrl}
            alt={image.caption || title}
            className="aspect-[4/3] w-full object-cover"
            fallbackClassName="aspect-[4/3] w-full"
            fallbackLabel="Imagem indisponivel"
            fallbackHint="Volte ao Inbox e envie novamente."
          />
          <div className="border-t border-border bg-background/80 px-2.5 py-2">
            <div className="truncate text-[11px] font-medium text-foreground">
              {formatSourceLabel(image)}
            </div>
            {image.caption && (
              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                {image.caption}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-36 place-items-center rounded border-[1.5px] border-dashed border-border bg-muted/40 p-5 text-center">
          <div>
            <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-[12px] font-medium text-foreground">
              Envie uma imagem do Inbox ou do dispositivo
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Abra uma imagem na conversa e escolha "Usar como ambiente" ou "Usar como referencia".
            </p>
            {onUpload && (
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Upload
                <input type="file" accept="image/*" className="sr-only" onChange={onUpload} />
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
      <div className="mb-2">
        <div className="text-[12px] font-semibold text-foreground">
          2. Referencias
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          Combine produtos, texturas, materiais ou objetos no mesmo briefing.
        </div>
      </div>

      {references.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {references.map((reference, index) => (
            <div key={`${getReferenceKey(reference)}:${index}`} className="overflow-hidden rounded border border-border bg-muted">
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
                  {formatSourceLabel(reference)}
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
              Use imagens do Inbox ou busque produtos por SKU.
            </p>
            {onUpload && (
              <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Upload
                <input type="file" accept="image/*" className="sr-only" onChange={onUpload} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
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

export default function EditorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const router = useRouter()
  const storageKey = useMemo(() => getStudioDraftStorageKey(slug), [slug])
  const [baseImage, setBaseImage] = useState<StudioImageArtifact | null>(null)
  const [references, setReferences] = useState<StudioImageArtifact[]>([])
  const [strength, setStrength] = useState(72)
  const [prompt, setPrompt] = useState("")
  const [tool, setTool] = useState("cursor")
  const [leftOpen, setLeftOpen] = useState(true)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSearchingSku, setIsSearchingSku] = useState(false)
  const [skuQuery, setSkuQuery] = useState("")
  const [skuStatus, setSkuStatus] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdJob, setCreatedJob] = useState<CompositionJob | null>(null)
  // TODO: Revisit direct canvas tools when Studio supports in-place editing workflows.
  const showCanvasTools = false

  async function handleUpload(event: ChangeEvent<HTMLInputElement>, slot: "base" | "reference") {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      setError(null)
      setStatusMessage("Otimizando imagem para WebP...")
      const mediaUrl = await fileToOptimizedWebpDataUrl(file)
      const artifact: StudioImageArtifact = {
        source: "upload",
        mediaUrl,
        caption: file.name,
        contactName: "Studio",
        createdAt: new Date().toISOString(),
      }

      if (slot === "base") {
        setBaseImage(artifact)
        setStatusMessage("Imagem base otimizada para WebP.")
        return
      }

      setReferences((current) => mergeReferences(current, artifact))
      setStatusMessage("Referencia otimizada para WebP.")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Erro ao carregar imagem.")
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

  useEffect(() => {
    const draft = parseDraft(window.localStorage.getItem(storageKey))
    setBaseImage(draft.baseImage ?? null)
    setReferences(draft.references ?? (draft.referenceImage ? [draft.referenceImage] : []))
    setPrompt(draft.instruction ?? "")
    setStrength(typeof draft.strength === "number" ? draft.strength : 72)
    setDraftLoaded(true)
  }, [storageKey])

  useEffect(() => {
    if (!draftLoaded) return

    const nextDraft: StudioDraft = {
      baseImage: baseImage ?? undefined,
      referenceImage: references.at(-1),
      references,
      instruction: prompt,
      strength,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(storageKey, JSON.stringify(nextDraft))
  }, [baseImage, draftLoaded, prompt, references, storageKey, strength])

  const canGenerate = Boolean(baseImage && prompt.trim())

  function clearDraft() {
    setBaseImage(null)
    setReferences([])
    setPrompt("")
    setStrength(72)
    setCreatedJob(null)
    setError(null)
    setStatusMessage("Rascunho limpo.")
  }

  async function searchReferenceBySku() {
    const normalizedQuery = normalizeSku(skuQuery)
    if (!normalizedQuery || isSearchingSku) return

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
      setReferences((current) => mergeReferences(current, reference))
      setSkuStatus(`Referencia adicionada: ${item.name}${item.sku ? ` (${item.sku})` : ""}.`)
    } catch (searchError) {
      setSkuStatus(searchError instanceof Error ? searchError.message : "Erro ao buscar SKU.")
    } finally {
      setIsSearchingSku(false)
    }
  }

  async function createComposition() {
    if (!baseImage || !prompt.trim() || isGenerating) return

    setIsGenerating(true)
    setError(null)
    setStatusMessage(null)
    setCreatedJob(null)

    const body: CompositionJobInput = {
      conversationId: baseImage.conversationId || `studio:${slug}`,
      channelInstanceId: baseImage.channelInstanceId || "studio-upload",
      contactName: baseImage.contactName || "Contato",
      contactPhone: baseImage.contactPhone,
      mode: "interior",
      source: "operator",
      baseMessageId: baseImage.source === "inbox" ? baseImage.messageId : undefined,
      baseImageUrl: baseImage.mediaUrl,
      referenceMessageId: references.find((reference) => reference.source === "inbox")?.messageId,
      referenceImageUrl: references.find((reference) => reference.source === "inbox")?.mediaUrl,
      catalogItemId: references.find((reference) => reference.source === "catalog")?.catalogItemId,
      catalogItemName: references.find((reference) => reference.source === "catalog")?.catalogItemName,
      references: references.map((reference) => ({
        source: reference.source === "upload" ? "url" : reference.source,
        messageId: reference.source === "inbox" ? reference.messageId : undefined,
        imageUrl: reference.source === "inbox" || reference.source === "upload" ? reference.mediaUrl : undefined,
        catalogItemId: reference.source === "catalog" ? reference.catalogItemId : undefined,
        catalogItemName: reference.source === "catalog" ? reference.catalogItemName : undefined,
        catalogSku: reference.catalogSku,
        catalogCategory: reference.catalogCategory,
        catalogDescription: reference.catalogDescription,
      })),
      changeStrength: strength,
      prompt: [
        prompt.trim(),
        references
          .filter((reference) => reference.source === "catalog")
          .map((reference, index) => [
            `Referencia ${index + 1} selecionada por SKU: ${reference.catalogItemName || "produto"}.`,
            reference.catalogSku ? `SKU: ${reference.catalogSku}.` : "",
            reference.catalogCategory ? `Categoria: ${reference.catalogCategory}.` : "",
            reference.catalogDescription ? `Descricao do produto: ${reference.catalogDescription}.` : "",
          ].filter(Boolean).join(" "))
          .join("\n"),
        references.length > 0 ? "Use todas as imagens de referencia do Estudio em conjunto, respeitando o papel de cada uma descrito na instrucao do operador." : "",
      ].filter(Boolean).join("\n"),
    }

    try {
      const response = await fetch(`/api/tenant/${slug}/compositions/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null) as { job?: CompositionJob; error?: string } | null

      if (!response.ok || !payload?.job) {
        throw new Error(payload?.error || "Nao foi possivel criar a composicao.")
      }

      setCreatedJob(payload.job)
      setStatusMessage("Composicao enviada para a fila de processamento.")
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro ao criar composicao.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-7">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            NOVO
          </div>
          <div className="font-display text-xl font-semibold leading-tight tracking-tight">
            Estudio
          </div>
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
            onClick={() => setStatusMessage("Rascunho salvo neste navegador.")}
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={createComposition}
            disabled={!canGenerate || isGenerating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar composicao
          </button>
        </div>
      </div>

      {(error || statusMessage || createdJob) && (
        <div className={cn(
          "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-5 py-2 text-xs",
          error ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary"
        )}>
          <span>{error || statusMessage}</span>
          {createdJob && (
            <button
              type="button"
              onClick={() => router.push(`/tenant/${slug}/compositions`)}
              className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
            >
              Ver fila <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div
        className="grid flex-1 overflow-hidden bg-muted/30"
        style={{
          gridTemplateColumns: `${leftOpen ? "minmax(220px, 280px)" : "44px"} minmax(0, 1fr)`,
          transition: "grid-template-columns 0.2s",
        }}
      >
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
              Entradas
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col overflow-hidden border-r border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Entradas
              </span>
              <button
                onClick={() => setLeftOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Recolher"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 scrollbar-hide">
              <ImageSlotCard
                title="1. Ambiente base"
                description="Imagem principal que sera transformada."
                image={baseImage}
                onClear={() => setBaseImage(null)}
                onUpload={(event) => void handleUpload(event, "base")}
              />

              <ReferenceCollectionCard
                references={references}
                onRemove={(index) => setReferences((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                onUpload={(event) => void handleUpload(event, "reference")}
              />

              <div className="rounded border border-border bg-card p-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Buscar referencia por SKU
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
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={!skuQuery.trim() || isSearchingSku}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSearchingSku ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    Buscar
                  </button>
                </form>
                {skuStatus && (
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                    {skuStatus}
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  3. Instrucao
                </div>
                <textarea
                  className="w-full resize-y rounded border border-border bg-card p-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                  style={{ minHeight: 110 }}
                  placeholder="Ex: aplique o revestimento da referencia na parede do fundo, mantendo moveis, portas, janelas e iluminacao natural."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-1">
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
                  Baixa intensidade deixa a alteração mais discreta. Alta intensidade deixa a mudança mais evidente, mantendo realismo, escala e perspectiva.
                </p>
              </div>
            </div>

            <div className="border-t border-border bg-muted/50 px-4 py-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Processamento</span>
                <span className="font-mono">fila do tenant</span>
              </div>
            </div>
          </div>
        )}

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

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Ambiente base
              </span>
              <div className="relative flex-1 overflow-hidden rounded border border-border bg-card">
                {baseImage ? (
                  <SafeImage
                    src={baseImage.mediaUrl}
                    alt={baseImage.caption || "Ambiente base"}
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
                        Use uma imagem recebida no Inbox como ponto de partida.
                      </p>
                    </div>
                  </div>
                )}
                {baseImage && (
                  <div className="absolute left-3 top-3 rounded bg-accent px-2.5 py-1 text-[10.5px] font-semibold">
                    Ambiente do Inbox
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Pre-visualizacao
                </span>
                <div className="flex gap-1">
                  <button type="button" className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Rascunho
                  </button>
                  <button type="button" className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="relative flex-1 overflow-hidden rounded border border-primary/20 bg-card">
                {baseImage ? (
                  <>
                    <SafeImage
                      src={baseImage.mediaUrl}
                      alt="Pre-visualizacao"
                      className="h-full w-full object-contain opacity-95"
                      fallbackClassName="h-full w-full"
                      fallbackLabel="Pre-visualizacao indisponivel"
                    />
                    <div className="absolute inset-0 bg-primary/5" />
                    {references.length > 0 && (
                      <div className="absolute right-3 top-3 flex max-w-[55%] gap-1.5 overflow-hidden rounded border border-border bg-background/90 p-1.5">
                        {references.slice(0, 3).map((reference, index) => (
                          <div key={`${getReferenceKey(reference)}:preview:${index}`} className="relative h-14 w-14 overflow-hidden rounded-md bg-muted">
                            <SafeImage
                              src={reference.mediaUrl}
                              alt="Referencia"
                              className="h-full w-full object-cover"
                              fallbackClassName="h-full w-full"
                              fallbackLabel="Ref."
                            />
                          </div>
                        ))}
                        {references.length > 3 && (
                          <div className="grid h-14 w-14 place-items-center rounded-md bg-muted text-xs font-semibold">
                            +{references.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-x-3 bottom-3 flex items-center">
                      <span className="flex items-center gap-1.5 rounded bg-accent px-2.5 py-1 text-[10.5px] font-semibold">
                        <Sparkles className="h-3 w-3" /> pronto para gerar
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => void createComposition()}
                        disabled={!canGenerate || isGenerating}
                        className="rounded-full bg-primary px-2.5 py-1 text-[10.5px] font-medium text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-50"
                      >
                        Gerar
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="grid h-full min-h-72 place-items-center text-center text-muted-foreground">
                    <p className="max-w-xs px-6 text-sm">
                      A pre-visualizacao aparece depois que o ambiente base for enviado do Inbox.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Historico
            </span>
            <div className="flex gap-2.5 overflow-hidden">
              {[baseImage, ...references].map((image, index) => (
                <div
                  key={index}
                  className="aspect-[4/3] w-20 shrink-0 overflow-hidden rounded border border-border bg-muted"
                >
                  {image ? (
                    <SafeImage src={image.mediaUrl} alt="Historico" className="h-full w-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
