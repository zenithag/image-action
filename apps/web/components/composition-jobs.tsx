"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Link2,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react"

import { SafeImage } from "@/components/safe-image"
import { getCompositionBaseImageUrl, imageUrlWithVersion } from "@/lib/composition-image-url"
import { Button } from "@/components/ui/button"
import type { CompositionJob, CompositionJobStatus } from "@/lib/composition-types"
import { cn } from "@/lib/utils"

type CompositionJobsResponse = {
  jobs: CompositionJob[]
  stats: Record<CompositionJobStatus, number>
}

const emptyStats: Record<CompositionJobStatus, number> = {
  queued: 0,
  processing: 0,
  done: 0,
  failed: 0,
}

const statusConfig = {
  queued: {
    label: "Na fila",
    icon: Clock,
    className: "bg-warning/20 text-warning",
  },
  processing: {
    label: "Processando",
    icon: Loader2,
    className: "bg-primary text-white shadow-sm",
  },
  done: {
    label: "Concluido",
    icon: CheckCircle2,
    className: "bg-primary text-white shadow-sm",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "bg-destructive text-white shadow-sm",
  },
}

const modeLabels = {
  interior: "Interiores",
  product: "Produto",
  print: "Estampa",
  fashion: "Vestuario",
}

function formatJobTime(value?: string) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function getImageExtension(url: string) {
  const pathname = url.split("?")[0] || ""
  const extension = pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()

  if (extension && ["png", "jpg", "jpeg", "webp"].includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension
  }

  return "png"
}

async function imageUrlToObjectUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar uma das imagens.")
  }

  return URL.createObjectURL(await response.blob())
}

function loadImageElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Nao foi possivel preparar a imagem para download."))
    image.src = url
  })
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const drawX = x + (width - drawWidth) / 2
  const drawY = y + (height - drawHeight) / 2

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }

      reject(new Error("Nao foi possivel gerar o comparativo."))
    }, "image/png")
  })
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null) as T | { error?: string; message?: string } | null

  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload && "error" in payload && payload.error
      ? payload.error
      : typeof payload === "object" && payload && "message" in payload && payload.message
        ? payload.message
      : "Erro na requisicao."

    throw new Error(errorMessage)
  }

  return payload as T
}

function getJobCardMeta(job: CompositionJob) {
  if (job.status === "done") {
    return {
      label: "Finalizado",
      value: formatJobTime(job.completedAt ?? job.updatedAt),
      className: "text-primary",
    }
  }

  if (job.status === "processing") {
    return {
      label: "Iniciado",
      value: formatJobTime(job.startedAt ?? job.updatedAt),
      className: "text-primary",
    }
  }

  if (job.status === "failed") {
    return {
      label: "Falha",
      value: job.errorMessage ?? "Erro nao informado",
      className: "text-destructive",
    }
  }

  return {
    label: "Tentativas",
    value: String(job.processingAttempts),
    className: "text-foreground",
  }
}

export function CompositionJobs({ tenantSlug }: { tenantSlug: string }) {
  const [jobs, setJobs] = useState<CompositionJob[]>([])
  const [stats, setStats] = useState(emptyStats)
  const [viewingJob, setViewingJob] = useState<CompositionJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "review" | CompositionJobStatus>("all")
  const [error, setError] = useState<string | null>(null)

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs
    if (statusFilter === "review") return jobs.filter((job) => job.status === "queued")
    return jobs.filter((job) => job.status === statusFilter)
  }, [jobs, statusFilter])

  async function loadJobs(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true)
      setError(null)
    }

    try {
      const data = await requestJson<CompositionJobsResponse>(`/api/tenant/${tenantSlug}/compositions/jobs`, {
        cache: "no-store",
      })
      setJobs(data.jobs)
      setStats(data.stats)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar composicoes.")
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  async function retryJob(jobId: string) {
    setIsRetrying(jobId)
    setError(null)

    try {
      await requestJson<CompositionJob>(`/api/tenant/${tenantSlug}/compositions/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
      })
      await loadJobs({ silent: true })
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Nao foi possivel reprocessar o job.")
    } finally {
      setIsRetrying(null)
    }
  }

  async function processJob(jobId: string) {
    setIsProcessing(jobId)
    setError(null)

    try {
      await requestJson<{ ok: boolean; message: string; job: CompositionJob | null }>(
        `/api/tenant/${tenantSlug}/compositions/jobs/${encodeURIComponent(jobId)}/process`,
        { method: "POST" }
      )
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Nao foi possivel processar o job.")
    } finally {
      setIsProcessing(null)
      await loadJobs({ silent: true })
    }
  }

  async function processQueue() {
    setIsProcessingQueue(true)
    setError(null)

    try {
      await requestJson<{ ok: boolean; message: string; job: CompositionJob | null }>(
        `/api/tenant/${tenantSlug}/compositions/jobs/process`,
        { method: "POST" }
      )
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Nao foi possivel processar a fila.")
    } finally {
      setIsProcessingQueue(false)
      await loadJobs({ silent: true })
    }
  }

  async function archiveJob(jobId: string) {
    if (!window.confirm("Excluir esta composicao da lista? Ela continuara contando nas metricas.")) return

    setError(null)

    try {
      await requestJson<CompositionJob>(`/api/tenant/${tenantSlug}/compositions/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      })
      setViewingJob(null)
      await loadJobs({ silent: true })
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Nao foi possivel excluir a composicao.")
    }
  }

  useEffect(() => {
    void loadJobs()

    const intervalId = window.setInterval(() => {
      void loadJobs({ silent: true })
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [tenantSlug])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background px-7">
        <div className="flex flex-col">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Pipeline visual</p>
          <h1 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">Composições</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-[10px] font-sans"
            onClick={() => processQueue()}
            disabled={isProcessingQueue || stats.queued === 0}
          >
            {isProcessingQueue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Processar fila
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[10px] shadow-none font-sans"
            onClick={() => loadJobs()}
            disabled={isLoading}
          >
            <RotateCcw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3">
        {[
          { id: "all", label: "Todas", count: stats.queued + stats.processing + stats.done + stats.failed },
          { id: "review", label: "Revisão", count: stats.queued },
          { id: "processing", label: "Processando", count: stats.processing },
          { id: "done", label: "Concluídos", count: stats.done },
          { id: "failed", label: "Falhas", count: stats.failed },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setStatusFilter(chip.id as typeof statusFilter)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === chip.id
                ? "border-transparent bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {chip.label}
            <span className="font-mono text-[10px] opacity-60">{chip.count}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="mx-auto max-w-6xl space-y-4">
          {isLoading && jobs.length === 0 ? (
            <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando composicoes...
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex h-72 flex-col items-center justify-center rounded-[8px] border border-dashed border-border bg-card/40 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mt-4 font-bold text-foreground font-display">Nenhum job criado ainda</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground font-sans">
                Quando a IA receber imagem base e contexto suficiente no inbox, ela criara uma composicao e o job aparecera aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filteredJobs.map((job) => {
                const status = statusConfig[job.status]
                const StatusIcon = status.icon
                const baseImageUrl = imageUrlWithVersion(getCompositionBaseImageUrl(job), job.baseMessageId || job.createdAt)
                const meta = getJobCardMeta(job)
                return (
                  <div
                    key={job.id}
                    className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md"
                    onClick={() => setViewingJob(job)}
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      <SafeImage
                        src={baseImageUrl}
                        alt="Base"
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fallbackLabel="Preview indisponível"
                        fallbackHint={job.resultImageUrl ? "Resultado salvo, mas a imagem nao carregou." : "Imagem base nao encontrada."}
                      />
                      <div className="absolute left-2.5 top-2.5">
                        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider", status.className)}>
                          <StatusIcon className={cn("h-3 w-3", job.status === "processing" && "animate-spin")} />
                          {status.label}
                        </span>
                      </div>
                      <div className="absolute right-2.5 top-2.5">
                        <span className="rounded-full bg-white/90 px-2 py-0.5 font-mono text-[10px] text-foreground">{job.id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-card-foreground">{job.contactName}</span>
                        <button
                          type="button"
                          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          disabled={job.status === "processing"}
                          onClick={(event) => {
                            event.stopPropagation()
                            void archiveJob(job.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </button>
                      </div>
                      {job.contactPhone && (
                        <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{job.contactPhone}</p>
                      )}
                      <p className="mt-1 truncate text-xs text-muted-foreground">{job.prompt}</p>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{modeLabels[job.mode]}</span>
                        <span>· {formatJobTime(job.createdAt)}</span>
                      </div>
                      <div className="mt-2.5 flex items-start justify-between gap-3 text-[11px]">
                        <span className="text-muted-foreground">{meta.label}</span>
                        <span className={cn("max-w-[65%] truncate text-right font-medium", meta.className)} title={meta.value}>
                          {meta.value}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {viewingJob && (
        <CompositionViewerModal
          job={viewingJob}
          onClose={() => setViewingJob(null)}
          onRetry={retryJob}
          onProcess={processJob}
          onArchive={archiveJob}
          isRetrying={isRetrying}
          isProcessing={isProcessing}
        />
      )}
    </div>
  )
}

function CompositionViewerModal({
  job,
  onClose,
  onRetry,
  onProcess,
  onArchive,
  isRetrying,
  isProcessing,
}: {
  job: CompositionJob
  onClose: () => void
  onRetry: (jobId: string) => Promise<void>
  onProcess: (jobId: string) => Promise<void>
  onArchive: (jobId: string) => Promise<void>
  isRetrying: string | null
  isProcessing: string | null
}) {
  const [sliderPos, setSliderPos] = useState(50)
  const [comparisonView, setComparisonView] = useState<"slider" | "side-by-side">("slider")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingComparison, setIsDownloadingComparison] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [shareSuccess, setShareSuccess] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const isResizing = useRef(false)
  const baseImageUrl = imageUrlWithVersion(getCompositionBaseImageUrl(job), job.baseMessageId || job.createdAt)
  const jobResultImageUrl = imageUrlWithVersion(job.resultImageUrl, job.completedAt || job.updatedAt)
  const resultImageUrl = jobResultImageUrl || baseImageUrl

  const handleMouseDown = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault()
    isResizing.current = true
  }
  const handleMouseUp = () => { isResizing.current = false }
  const handleMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isResizing.current || !job.resultImageUrl) return
    event.preventDefault()
    const container = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const x = "touches" in event ? event.touches[0].clientX : event.clientX
    const position = ((x - container.left) / container.width) * 100
    setSliderPos(Math.max(0, Math.min(100, position)))
  }

  const downloadResult = async () => {
    if (!job.resultImageUrl || !jobResultImageUrl) return

    setIsDownloading(true)
    setDownloadError(null)

    try {
      const response = await fetch(jobResultImageUrl, { cache: "no-store" })

      if (!response.ok) {
        throw new Error("Nao foi possivel baixar o resultado.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")

      link.href = objectUrl
      link.download = `composicao-${job.id.slice(0, 8)}.${getImageExtension(job.resultImageUrl)}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Nao foi possivel baixar o resultado.")
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadSideBySideComparison = async () => {
    if (!baseImageUrl || !job.resultImageUrl || !jobResultImageUrl) return

    const objectUrls: string[] = []

    setIsDownloadingComparison(true)
    setDownloadError(null)

    try {
      const [baseObjectUrl, resultObjectUrl] = await Promise.all([
        imageUrlToObjectUrl(baseImageUrl),
        imageUrlToObjectUrl(jobResultImageUrl),
      ])

      objectUrls.push(baseObjectUrl, resultObjectUrl)

      const [baseImage, resultImage] = await Promise.all([
        loadImageElement(baseObjectUrl),
        loadImageElement(resultObjectUrl),
      ])

      const panelWidth = Math.min(Math.max(baseImage.naturalWidth, resultImage.naturalWidth), 1600)
      const panelHeight = Math.min(Math.max(baseImage.naturalHeight, resultImage.naturalHeight), 1600)
      const dividerWidth = 6
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        throw new Error("Nao foi possivel gerar o comparativo.")
      }

      canvas.width = panelWidth * 2 + dividerWidth
      canvas.height = panelHeight

      context.fillStyle = "#050505"
      context.fillRect(0, 0, canvas.width, canvas.height)
      drawContainedImage(context, baseImage, 0, 0, panelWidth, panelHeight)
      context.fillStyle = "#22c55e"
      context.fillRect(panelWidth, 0, dividerWidth, panelHeight)
      drawContainedImage(context, resultImage, panelWidth + dividerWidth, 0, panelWidth, panelHeight)

      const blob = await canvasToPngBlob(canvas)
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")

      objectUrls.push(downloadUrl)
      link.href = downloadUrl
      link.download = `comparativo-${job.id.slice(0, 8)}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Nao foi possivel baixar o comparativo.")
    } finally {
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
      setIsDownloadingComparison(false)
    }
  }

  const copyShareLink = async () => {
    setIsSharing(true)
    setDownloadError(null)
    setShareSuccess(null)

    try {
      const payload = await requestJson<{ sharePath: string }>(
        `/api/tenant/${job.tenantSlug}/compositions/jobs/${encodeURIComponent(job.id)}/share`,
        { method: "POST" },
      )

      const shareUrl = `${window.location.origin}${payload.sharePath}`

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const input = document.createElement("input")
        input.value = shareUrl
        document.body.appendChild(input)
        input.select()
        document.execCommand("copy")
        input.remove()
      }

      setShareSuccess("Link público copiado.")
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Nao foi possivel gerar o link publico.")
    } finally {
      setIsSharing(false)
    }
  }

  const archiveJob = async () => {
    setIsArchiving(true)
    setDownloadError(null)

    try {
      await onArchive(job.id)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Nao foi possivel excluir a composicao.")
    } finally {
      setIsArchiving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-[1000px] flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display">
              <ImageIcon className="h-5 w-5 text-primary" /> Job de {job.contactName}
            </h2>
            <p className="text-xs text-muted-foreground">{job.catalogItemName || "Produto a definir"} - {modeLabels[job.mode]}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-[10px] border border-border bg-background p-1">
              <button
                type="button"
                className={cn(
                  "rounded-[4px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  comparisonView === "slider"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setComparisonView("slider")}
              >
                Arraste
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-[4px] px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  comparisonView === "side-by-side"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setComparisonView("side-by-side")}
              >
                Lado a lado
              </button>
            </div>
            <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-muted">
              <XCircle className="h-6 w-6 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
          <div
            className="relative select-none bg-neutral-950"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onDragStart={(event) => event.preventDefault()}
          >
            {comparisonView === "slider" ? (
              <div className="relative flex h-[72vh] min-h-[520px] w-full touch-none items-center justify-center overflow-hidden bg-neutral-950">
                {resultImageUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
                    <SafeImage
                      src={resultImageUrl}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                      alt={job.resultImageUrl ? "Resultado" : "Imagem base"}
                      draggable={false}
                      fallbackLabel="Imagem indisponível"
                      fallbackHint="Nao foi possivel carregar este preview."
                    />
                  </div>
                ) : (
                  <ImageIcon className="h-16 w-16 text-white/35" />
                )}

                {job.resultImageUrl && baseImageUrl && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden bg-neutral-950"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-950">
                        <SafeImage
                          src={baseImageUrl}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain"
                          alt="Imagem original"
                          draggable={false}
                          fallbackLabel="Original indisponível"
                          fallbackHint="Nao foi possivel carregar a imagem base."
                        />
                      </div>
                      <div className="absolute left-4 top-4 rounded-sm bg-black/60 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">Original</div>
                    </div>

                    <div className="absolute right-4 top-4 z-10 rounded-sm bg-primary/85 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">Nova imagem</div>
                    <div
                      className="absolute inset-y-0 z-30 cursor-ew-resize group"
                      style={{ left: `${sliderPos}%` }}
                      onMouseDown={handleMouseDown}
                      onTouchStart={handleMouseDown}
                    >
                      <div className="h-full w-1 -translate-x-1/2 bg-white/90 shadow-[0_0_18px_rgba(0,0,0,0.45)]" />
                      <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-primary shadow-xl transition-transform group-hover:scale-110">
                        <div className="flex gap-0.5">
                          <div className="h-2 w-0.5 bg-white" />
                          <div className="h-2 w-0.5 bg-white" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid h-[72vh] min-h-[520px] w-full grid-cols-1 gap-px bg-border md:grid-cols-2">
                <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-neutral-950">
                  <div className="absolute left-4 top-4 z-10 rounded-sm bg-black/65 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">Original</div>
                  {baseImageUrl ? (
                    <SafeImage
                      src={baseImageUrl}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                      alt="Imagem original"
                      draggable={false}
                      fallbackLabel="Original indisponível"
                      fallbackHint="Nao foi possivel carregar a imagem base."
                    />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-white/35" />
                  )}
                </div>

                <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-neutral-950">
                  <div className="absolute right-4 top-4 z-10 rounded-sm bg-primary/85 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white">Nova imagem</div>
                  {resultImageUrl ? (
                    <SafeImage
                      src={resultImageUrl}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                      alt={job.resultImageUrl ? "Nova imagem" : "Imagem base"}
                      draggable={false}
                      fallbackLabel="Resultado indisponível"
                      fallbackHint="Nao foi possivel carregar a nova imagem."
                    />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-white/35" />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col border-l border-border bg-card p-5 overflow-y-auto">
            <div className="space-y-5 flex-1">
              <div>
                <h4 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Informacoes</h4>
                <div className="space-y-2.5">
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Cliente</span><span className="font-medium truncate">{job.contactName}</span></div>
                  {job.contactPhone && (
                    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Telefone</span><span className="truncate font-mono text-xs text-foreground">{job.contactPhone}</span></div>
                  )}
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">ID do job</span><span className="font-mono">{job.id.slice(0, 8)}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Status</span><span className="font-bold text-primary">{statusConfig[job.status].label}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Modo</span><span className="rounded-full border border-border px-2 py-0.5 text-[10px]">{modeLabels[job.mode]}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Origem</span><span>{job.source === "ai" ? "IA" : "Operador"}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Criado em</span><span>{formatJobTime(job.createdAt)}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Tentativas</span><span className="font-mono">{job.processingAttempts}</span></div>
                  {job.processorProvider && (
                    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Provider</span><span className="font-mono text-xs truncate max-w-[160px]">{job.processorProvider}</span></div>
                  )}
                  {job.processorModel && (
                    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Modelo</span><span className="font-mono text-xs truncate max-w-[160px]">{job.processorModel}</span></div>
                  )}
                  {job.startedAt && (
                    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Iniciado em</span><span>{formatJobTime(job.startedAt)}</span></div>
                  )}
                  {job.completedAt && (
                    <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Finalizado em</span><span>{formatJobTime(job.completedAt)}</span></div>
                  )}
                </div>
              </div>

              <div className="rounded-[10px] border border-primary/10 bg-primary/5 p-4">
                <p className="text-xs italic leading-relaxed text-muted-foreground">{job.prompt}</p>
              </div>

              {job.errorMessage && (
                <div className="rounded-[10px] border border-destructive/20 bg-destructive/10 p-4">
                  <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-destructive">Falha registrada</h4>
                  <p className="text-xs leading-relaxed text-destructive">{job.errorMessage}</p>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-2.5">
              {(job.status === "queued" || job.status === "failed") && (
                <Button
                  className="w-full rounded-[10px] py-5 font-sans"
                  disabled={isProcessing === job.id}
                  onClick={() => onProcess(job.id)}
                >
                  {isProcessing === job.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Processar agora
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full rounded-[10px] py-5 font-sans shadow-none"
                disabled={isRetrying === job.id || job.status === "processing"}
                onClick={() => onRetry(job.id)}
              >
                {isRetrying === job.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                Reenfileirar
              </Button>

              <div className="border-t border-border pt-2.5 mt-2.5 space-y-2.5">
                {shareSuccess && (
                  <p className="rounded-[10px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                    {shareSuccess}
                  </p>
                )}
                {downloadError && (
                  <p className="rounded-[10px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {downloadError}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-[10px] font-sans"
                  disabled={!baseImageUrl || !job.resultImageUrl || job.status !== "done" || isSharing}
                  onClick={copyShareLink}
                >
                  {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                  {isSharing ? "Gerando link..." : "Copiar link público"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-[10px] font-sans"
                  disabled={!baseImageUrl || !job.resultImageUrl || isDownloadingComparison}
                  onClick={downloadSideBySideComparison}
                >
                  {isDownloadingComparison ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isDownloadingComparison ? "Gerando..." : "Baixar comparativo"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full rounded-[10px] font-sans"
                  disabled={!job.resultImageUrl || isDownloading}
                  onClick={downloadResult}
                >
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isDownloading ? "Baixando..." : "Download resultado"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-[10px] font-sans text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isArchiving || job.status === "processing"}
                  onClick={archiveJob}
                >
                  {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Excluir composição
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
