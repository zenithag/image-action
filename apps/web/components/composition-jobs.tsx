"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react"

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
    className: "bg-primary/20 text-primary",
  },
  done: {
    label: "Concluido",
    icon: CheckCircle2,
    className: "bg-primary/20 text-primary",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "bg-destructive/20 text-destructive",
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

function imageUrlWithVersion(url: string | undefined, version: string | undefined) {
  if (!url || !version || url.startsWith("data:")) return url

  const separator = url.includes("?") ? "&" : "?"

  return `${url}${separator}v=${encodeURIComponent(version)}`
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

export function CompositionJobs({ tenantSlug }: { tenantSlug: string }) {
  const [jobs, setJobs] = useState<CompositionJob[]>([])
  const [stats, setStats] = useState(emptyStats)
  const [viewingJob, setViewingJob] = useState<CompositionJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    void loadJobs()

    const intervalId = window.setInterval(() => {
      void loadJobs({ silent: true })
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [tenantSlug])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-border bg-background py-4 pl-6 pr-10">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Jobs de Composicao</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Acompanhe os jobs reais criados a partir das conversas do WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="rounded-[5px] font-sans"
            onClick={() => processQueue()}
            disabled={isProcessingQueue || stats.queued === 0}
          >
            {isProcessingQueue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Processar fila
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-[5px] shadow-none font-sans"
            onClick={() => loadJobs()}
            disabled={isLoading}
          >
            <RotateCcw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-border bg-card/30 px-6 py-6 lg:grid-cols-4">
        {[
          { label: "Na fila", value: stats.queued, color: "text-warning", bg: "bg-warning/10" },
          { label: "Processando", value: stats.processing, color: "text-primary", bg: "bg-primary/10" },
          { label: "Concluidos", value: stats.done, color: "text-primary", bg: "bg-primary/10" },
          { label: "Falhas", value: stats.failed, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[5px] border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-sans">{stat.label}</p>
            <p className={cn("mt-2 text-3xl font-bold font-display", stat.color)}>{stat.value}</p>
          </div>
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
            jobs.map((job) => {
              const status = statusConfig[job.status]
              const StatusIcon = status.icon
              const baseImageUrl = imageUrlWithVersion(job.baseImageUrl, job.baseMessageId || job.createdAt)
              const resultImageUrl = imageUrlWithVersion(job.resultImageUrl, job.completedAt || job.updatedAt)

              return (
                <div
                  key={job.id}
                  className="group flex items-center gap-6 rounded-[5px] border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[5px] border border-border bg-muted">
                    {baseImageUrl ? (
                      <img
                        src={baseImageUrl}
                        alt="Imagem base"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute left-1 top-1 rounded bg-black/50 px-1 text-[8px] uppercase text-white">Base</div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="truncate text-base font-bold text-card-foreground font-display">{job.contactName}</h4>
                      <span
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          status.className
                        )}
                      >
                        <StatusIcon className={cn("h-3 w-3", job.status === "processing" && "animate-spin")} />
                        {status.label}
                      </span>
                    </div>

                    <p className="mt-1 truncate text-sm text-foreground font-sans">
                      <span className="font-semibold text-primary">{job.catalogItemName || "Produto a definir"}</span>
                      <span className="mx-2 text-muted-foreground">-</span>
                      <span className="text-muted-foreground">{modeLabels[job.mode]}</span>
                    </p>

                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground font-sans">{job.prompt}</p>

                    {job.errorMessage && (
                      <p className="mt-2 border-l-2 border-destructive pl-2 text-xs font-medium text-destructive">{job.errorMessage}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-sans">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Criado: {formatJobTime(job.createdAt)}</span>
                      <span className="font-mono">ID: {job.id.slice(0, 8)}</span>
                      {job.completedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> Concluido: {formatJobTime(job.completedAt)}</span>}
                    </div>
                  </div>

                  {job.resultImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setViewingJob(job)}
                      className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-[5px] border border-border bg-muted group/result"
                    >
                      <img src={resultImageUrl} alt="Resultado" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 backdrop-blur-[2px] transition-opacity group-hover/result:opacity-100">
                        <Eye className="h-6 w-6 text-white drop-shadow-md" />
                      </div>
                      <div className="absolute left-1 top-1 rounded bg-primary/80 px-1 text-[8px] uppercase text-white">Novo</div>
                    </button>
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[5px] border-2 border-dashed border-border bg-muted/30">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}

                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingJob(job)}
                      className="rounded-[5px] border-primary/20 text-primary hover:bg-primary/10 font-sans"
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      Detalhes
                    </Button>
                    {job.status === "failed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-[5px] border-destructive/20 text-destructive hover:bg-destructive/10 font-sans"
                        onClick={() => retryJob(job.id)}
                        disabled={isRetrying === job.id}
                      >
                        {isRetrying === job.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                        Tentar novamente
                      </Button>
                    )}
                    {job.status === "queued" && (
                      <Button
                        size="sm"
                        className="rounded-[5px] font-sans"
                        onClick={() => processJob(job.id)}
                        disabled={isProcessing === job.id}
                      >
                        {isProcessing === job.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                        Processar
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {viewingJob && (
        <CompositionViewerModal job={viewingJob} onClose={() => setViewingJob(null)} />
      )}
    </div>
  )
}

function CompositionViewerModal({ job, onClose }: { job: CompositionJob; onClose: () => void }) {
  const [sliderPos, setSliderPos] = useState(50)
  const [comparisonView, setComparisonView] = useState<"slider" | "side-by-side">("slider")
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingComparison, setIsDownloadingComparison] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const isResizing = useRef(false)
  const baseImageUrl = imageUrlWithVersion(job.baseImageUrl, job.baseMessageId || job.createdAt)
  const jobResultImageUrl = imageUrlWithVersion(job.resultImageUrl, job.completedAt || job.updatedAt)
  const resultImageUrl = jobResultImageUrl || baseImageUrl

  const handleMouseDown = () => { isResizing.current = true }
  const handleMouseUp = () => { isResizing.current = false }
  const handleMouseMove = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isResizing.current || !job.resultImageUrl) return
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-2xl 2xl:max-w-[1600px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-display">
              <ImageIcon className="h-5 w-5 text-primary" /> Job de {job.contactName}
            </h2>
            <p className="text-xs text-muted-foreground">{job.catalogItemName || "Produto a definir"} - {modeLabels[job.mode]}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-[5px] border border-border bg-background p-1">
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

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div
            className="relative select-none bg-black"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            {comparisonView === "slider" ? (
              <div className="relative flex h-[72vh] min-h-[520px] w-full items-center justify-center overflow-hidden">
                {resultImageUrl ? (
                  <img src={resultImageUrl} className="absolute h-full w-full object-contain" alt={job.resultImageUrl ? "Resultado" : "Imagem base"} />
                ) : (
                  <ImageIcon className="h-16 w-16 text-white/35" />
                )}

                {job.resultImageUrl && baseImageUrl && (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <img src={baseImageUrl} className="absolute h-full w-full object-contain" alt="Imagem original" />
                      <div className="absolute left-4 top-4 rounded-sm bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Original</div>
                    </div>

                    <div className="absolute right-4 top-4 z-10 rounded-sm bg-primary/85 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Nova imagem</div>
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
                <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-black">
                  <div className="absolute left-4 top-4 z-10 rounded-sm bg-black/65 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Original</div>
                  {baseImageUrl ? (
                    <img src={baseImageUrl} className="h-full w-full object-contain" alt="Imagem original" />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-white/35" />
                  )}
                </div>

                <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-black">
                  <div className="absolute right-4 top-4 z-10 rounded-sm bg-primary/85 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">Nova imagem</div>
                  {resultImageUrl ? (
                    <img src={resultImageUrl} className="h-full w-full object-contain" alt={job.resultImageUrl ? "Nova imagem" : "Imagem base"} />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-white/35" />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between border-l border-border bg-card p-6">
            <div className="space-y-6">
              <div>
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Informacoes</h4>
                <div className="space-y-3">
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">ID do job</span><span className="font-mono">{job.id.slice(0, 8)}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Status</span><span className="font-bold text-primary">{statusConfig[job.status].label}</span></div>
                  <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">Criado em</span><span>{formatJobTime(job.createdAt)}</span></div>
                </div>
              </div>
              <div className="rounded-[5px] border border-primary/10 bg-primary/5 p-4">
                <p className="text-xs italic leading-relaxed text-muted-foreground">{job.prompt}</p>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              {downloadError && (
                <p className="rounded-[5px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {downloadError}
                </p>
              )}
              <Button
                variant="secondary"
                className="w-full rounded-[5px] py-6 font-sans"
                disabled={!baseImageUrl || !job.resultImageUrl || isDownloadingComparison}
                onClick={downloadSideBySideComparison}
              >
                {isDownloadingComparison ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isDownloadingComparison ? "Gerando..." : "Baixar comparativo lado a lado"}
              </Button>
              <Button
                className="w-full rounded-[5px] py-6 font-sans"
                disabled={!job.resultImageUrl || isDownloading}
                onClick={downloadResult}
              >
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isDownloading ? "Baixando..." : "Download Resultado"}
              </Button>
              <Button variant="outline" className="w-full rounded-[5px] py-6 font-sans" disabled={!job.resultImageUrl}>
                Compartilhar via WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
