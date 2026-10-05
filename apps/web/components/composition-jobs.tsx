"use client"

import { PageHeader } from "@/components/organisms/page-header"
import { ToggleButton } from "@/components/spectrum/toggle-button"
import { Tabs } from "@/components/spectrum/tabs"
import { Input, NativeSelect } from "@/components/spectrum/fields"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight, ArrowLeftRight, CalendarDays, Columns2, Copy, Download, Grid2X2, Hash, List, Maximize, Minimize, Minus, MoreVertical, Plus, Search, X,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from "@/components/spectrum/icons"

import { Dialog, DropdownMenu } from "radix-ui"
import styles from "./composition-jobs.module.css"
import overviewStyles from "./tenant-overview.module.css"

import { SafeImage } from "@/components/safe-image"
import { getCompositionBaseImageUrl, getCompositionThumbnailUrl, imageUrlWithVersion } from "@/lib/composition-image-url"
import { Button } from "@/components/ui/button"
import type { CompositionJob, CompositionJobStatus } from "@/lib/composition-types"
import { cn } from "@/lib/utils"

type CompositionJobsResponse = {
  jobs: CompositionJob[]
  stats: Record<CompositionJobStatus, number>
}

type CompositionCleanupResponse = {
  ok: boolean
  deletedJobs: number
  deletedFiles: number
  deletedGeneratedAssets: number
  freedBytes: number
  failedFiles: Array<{ path: string; error: string }>
  processingJobs: Array<{ id: string; contactName: string }>
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
    className: "bg-primary text-primary-foreground",
  },
  done: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "bg-primary text-primary-foreground",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    className: "bg-destructive text-white",
  },
}

const modeLabels = {
  interior: "Interiores",
  product: "Produto",
  print: "Estampa",
  fashion: "Vestuário",
}

function formatCompositionError(message?: string | null) {
  if (!message) return "Não foi possível concluir esta composição."
  if (/openrouter|provider|provedor/i.test(message)) {
    if (/nenhum|configur|api.?key|credencia|credit|crédit|saldo/i.test(message)) return "Provedor de IA não configurado."
    return "O serviço de IA está indisponível. Tente novamente mais tarde."
  }
  return message
}

function formatJobTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return "—"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toLocaleString("pt-BR", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  })} ${units[unitIndex]}`
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

    throw new Error(formatCompositionError(errorMessage))
  }

  return payload as T
}

function CompositionMenu({ label, items }: { label: string; items: Array<{ label: string; action: () => void; disabled?: boolean; destructive?: boolean }> }) {
  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild><Button variant="ghost" size="icon" type="button" aria-label={label}><MoreVertical size={18} /></Button></DropdownMenu.Trigger>
    <DropdownMenu.Portal><DropdownMenu.Content className={styles.menu} align="end" sideOffset={6}>
      {items.map((item) => <DropdownMenu.Item key={item.label} className={cn(styles.menuItem, item.destructive && styles.destructive)} disabled={item.disabled} onSelect={item.action}>{item.label}</DropdownMenu.Item>)}
    </DropdownMenu.Content></DropdownMenu.Portal>
  </DropdownMenu.Root>
}

export function CompositionJobs({ tenantSlug }: { tenantSlug: string }) {
  const [jobs, setJobs] = useState<CompositionJob[]>([])
  const [stats, setStats] = useState(emptyStats)
  const [viewingJob, setViewingJob] = useState<CompositionJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRetrying, setIsRetrying] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState<string | null>(null)
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)
  const [isCleaningStorage, setIsCleaningStorage] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "review" | CompositionJobStatus>("all")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [layout, setLayout] = useState<"grid" | "list">("grid")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR")
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === "all" || job.status === (statusFilter === "review" ? "queued" : statusFilter)
      const matchesCategory = category === "all" || job.mode === category
      const matchesSearch = `${job.contactName} ${job.contactPhone ?? ""} ${job.prompt} ${job.catalogItemName ?? ""} ${job.id}`.toLocaleLowerCase("pt-BR").includes(query)
      return matchesStatus && matchesCategory && matchesSearch
    })
  }, [jobs, statusFilter, category, search])

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
    setNotice(null)

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
    setNotice(null)

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
    setNotice(null)

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
    setNotice(null)

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

  async function cleanupStorage() {
    if (jobs.some((job) => job.status === "processing")) {
      setError("Aguarde as composicoes em processamento finalizarem antes de limpar o armazenamento.")
      return
    }

    const confirmed = window.confirm(
      [
        "Limpar a base de imagens e composicoes deste tenant?",
        "",
        "Esta acao apaga os arquivos de imagem do servidor e remove todos os jobs de composicao, imagens base salvas, resultados e miniaturas geradas.",
        "Historico de conversas e catalogo nao serao apagados.",
      ].join("\n")
    )

    if (!confirmed) return

    setIsCleaningStorage(true)
    setError(null)
    setNotice(null)

    try {
      const result = await requestJson<CompositionCleanupResponse>(
        `/api/tenant/${tenantSlug}/compositions/cleanup`,
        { method: "POST" }
      )

      const failedSuffix = result.failedFiles.length > 0
        ? ` ${result.failedFiles.length} arquivo(s) precisam de revisao manual.`
        : ""

      setViewingJob(null)
      setNotice(
        `Limpeza concluida: ${result.deletedJobs} composicao(oes), ${result.deletedFiles} arquivo(s) do servidor e ${result.deletedGeneratedAssets} asset(s) persistido(s) removidos. Espaco liberado: ${formatBytes(result.freedBytes)}.${failedSuffix}`
      )
      await loadJobs({ silent: true })
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Nao foi possivel limpar o armazenamento.")
    } finally {
      setIsCleaningStorage(false)
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
    <div className={cn(overviewStyles.surface, styles.surface)}>
      <PageHeader
        title="composições"
        search={{ value: search, onChange: setSearch, label: "Buscar composições", placeholder: "Buscar composições por nome, contato ou descrição..." }}
        actions={
          <>
          <Button variant="outline" onClick={() => loadJobs()} disabled={isLoading}><RotateCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />Atualizar</Button>
            <Button className={styles.process} onClick={() => processQueue()} disabled={isProcessingQueue || stats.queued === 0}>{isProcessingQueue ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Processar</Button>
            <CompositionMenu label="Mais ações das composições" items={[{ label: isCleaningStorage ? "Limpando armazenamento…" : "Limpar armazenamento", action: () => void cleanupStorage(), disabled: isCleaningStorage || isProcessingQueue || jobs.length === 0 || stats.processing > 0, destructive: true }]} />
          </>
        }
      />
      <Tabs
        className={styles.tabs}
        aria-label="Filtrar por status"
        value={statusFilter}
        onValueChange={(next) => setStatusFilter(next as typeof statusFilter)}
        items={[
          { value: "all", label: "Todas", count: stats.queued + stats.processing + stats.done + stats.failed },
          { value: "review", label: "Em revisão", count: stats.queued },
          { value: "processing", label: "Processando", count: stats.processing },
          { value: "done", label: "Concluídas", count: stats.done },
          { value: "failed", label: "Falhas", count: stats.failed },
        ]}
      />
      {error && <div role="alert" className={styles.error}>{error}</div>}
      {notice && <div role="status" className={styles.notice}>{notice}</div>}
      <div className={styles.content}>
        <div className={styles.toolbar}>
          <NativeSelect aria-label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Categoria: Todas</option>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>
          <div className={styles.viewSwitch} role="group" aria-label="Visualização"><ToggleButton selected={layout === "grid"} aria-label="Visualização em grade" onClick={() => setLayout("grid")}><Grid2X2 size={18} /></ToggleButton><ToggleButton selected={layout === "list"} aria-label="Visualização em lista" onClick={() => setLayout("list")}><List size={20} /></ToggleButton></div>
          <p className={styles.summary} aria-live="polite">{filteredJobs.length} {filteredJobs.length === 1 ? "composição" : "composições"} · {stats.failed} {stats.failed === 1 ? "falha" : "falhas"}</p>
        </div>
        {isLoading && jobs.length === 0 ? <div className={styles.empty} role="status"><Loader2 className="animate-spin" /><p>Carregando composições...</p></div> : jobs.length === 0 ? (
          <div className={styles.empty}><ImageIcon size={36} /><h2>{error ? "Não foi possível carregar as composições" : "Suas composições aparecerão aqui"}</h2><p>{error ? "Clique em Atualizar para tentar novamente." : "Crie uma composição no Estúdio ou acompanhe os resultados dos atendimentos no Inbox."}</p></div>
        ) : filteredJobs.length === 0 ? <div className={styles.empty}><Search size={32} /><h2>Nenhuma composição encontrada</h2><p>Tente outro termo ou ajuste os filtros.</p><Button variant="outline" onClick={() => { setSearch(""); setCategory("all"); setStatusFilter("all") }}>Limpar filtros</Button></div> : (
          <div className={cn(styles.grid, layout === "list" && styles.list)}>
            {filteredJobs.map((job) => {
              const status = statusConfig[job.status]
              const StatusIcon = status.icon
              const title = job.contactName || `Composição ${job.id.slice(0, 8)}`
              return <article key={job.id} className={styles.card}>
                <div className={styles.preview}>
                  <button type="button" className={styles.imageButton} onClick={() => setViewingJob(job)} aria-label={`Abrir composição de ${title}`}>
                    <SafeImage src={getCompositionThumbnailUrl(job, { width: 768 })} alt={job.resultImageUrl ? `Composição de ${title}` : `Imagem base de ${title}`} className={styles.image} loading="lazy" decoding="async" sizes="(min-width: 1450px) 30vw, (min-width: 900px) 40vw, 100vw" fallbackLabel="Prévia indisponível" fallbackHint={job.resultImageUrl ? "Abra a composição para ver os detalhes." : "Esta composição ainda não tem uma imagem disponível."} />
                  </button>
                  <div className={styles.hoverOverlay}><Button type="button" onClick={() => setViewingJob(job)}>Ver composição</Button></div>
                  <span className={cn(styles.badge, styles[job.status])}><StatusIcon size={15} className={job.status === "processing" ? "animate-spin" : undefined} />{status.label}</span>
                  <div className={styles.cardMenu} data-glass=""><CompositionMenu label={`Ações da composição ${job.id.slice(0, 8)}`} items={[
                    { label: "Ver composição", action: () => setViewingJob(job) },
                    { label: "Reenfileirar", action: () => void retryJob(job.id), disabled: job.status === "processing" || isRetrying === job.id },
                    { label: "Excluir composição", action: () => void archiveJob(job.id), disabled: job.status === "processing", destructive: true },
                  ]} /></div>
                </div>
                <div className={styles.cardBody}>
                  <h2>{title}</h2>
                  {job.contactPhone && <p className={styles.phone}>{job.contactPhone}</p>}
                  <p className={styles.prompt} title={job.prompt}>{job.prompt || "Sem descrição"}</p>
                  <span className={styles.category}>{modeLabels[job.mode]}</span>
                  <dl className={styles.metadata}>
                    <div><CalendarDays size={16} /><dt>Criada em</dt><dd>{formatJobTime(job.createdAt)}</dd></div>
                    <div><StatusIcon size={16} /><dt>{job.status === "done" ? "Finalizada em" : job.status === "processing" ? "Iniciada em" : "Atualizada em"}</dt><dd className={job.status === "done" ? styles.success : undefined}>{formatJobTime(job.completedAt || job.startedAt || job.updatedAt)}</dd></div>
                    <div><Hash size={16} /><dt>ID</dt><dd title={job.id}>{job.id.slice(0, 8)}</dd></div>
                  </dl>
                  {job.status === "failed" && <p className={styles.failure} title={formatCompositionError(job.errorMessage)}>{formatCompositionError(job.errorMessage)}</p>}
                </div>
              </article>
            })}
          </div>
        )}
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
  const [zoom, setZoom] = useState(100)
  const [expanded, setExpanded] = useState(false)
  const baseImageUrl = imageUrlWithVersion(getCompositionBaseImageUrl(job), job.baseMessageId || job.createdAt)
  const jobResultImageUrl = imageUrlWithVersion(job.resultImageUrl, job.completedAt || job.updatedAt)
  const resultImageUrl = jobResultImageUrl || baseImageUrl
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

  const canCompare = Boolean(baseImageUrl && jobResultImageUrl)
  const StatusIcon = statusConfig[job.status].icon

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.viewerOverlay} />
        <Dialog.Content className={cn(overviewStyles.surface, styles.viewer)} aria-describedby="composition-description">
          <header className={styles.viewerHeader}>
            <div className={styles.viewerTitle}>
              <ImageIcon size={32} aria-hidden="true" />
              <div><Dialog.Title>Job de {job.contactName || "Studio"}</Dialog.Title><Dialog.Description id="composition-description">{job.catalogItemName || "Produto a definir"} · {modeLabels[job.mode]}</Dialog.Description></div>
              <span className={cn(styles.viewerBadge, styles[job.status])}><StatusIcon size={16} />{statusConfig[job.status].label}</span>
            </div>
            <div className={styles.viewerActions}>
              <Button className={styles.download} disabled={!jobResultImageUrl || isDownloading} onClick={downloadResult}>{isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} {isDownloading ? "Baixando..." : "Baixar imagem"}</Button>
              <CompositionMenu label="Mais ações da composição" items={[
                { label: isSharing ? "Gerando link..." : "Copiar link público", action: () => void copyShareLink(), disabled: !canCompare || job.status !== "done" || isSharing },
                { label: isDownloadingComparison ? "Gerando comparativo..." : "Baixar comparativo", action: () => void downloadSideBySideComparison(), disabled: !canCompare || isDownloadingComparison },
                { label: "Reenfileirar", action: () => void onRetry(job.id), disabled: job.status === "processing" || isRetrying === job.id },
                { label: "Excluir composição", action: () => void archiveJob(), disabled: job.status === "processing" || isArchiving, destructive: true },
              ]} />
              <Dialog.Close className={styles.close} aria-label="Fechar composição"><X size={24} /></Dialog.Close>
            </div>
          </header>
          {downloadError && <p className={styles.error} role="alert">{formatCompositionError(downloadError)}</p>}
          {shareSuccess && <p className={styles.notice} role="status">{shareSuccess}</p>}
          <div className={cn(styles.viewerBody, expanded && styles.expanded)}>
            <section className={styles.comparison} aria-label="Comparação de imagens">
              <div className={styles.comparisonHeader}>
                <h3><Columns2 size={22} />Comparação</h3>
                <div className={styles.comparisonSwitch} role="group" aria-label="Modo de comparação">
                  <ToggleButton selected={comparisonView === "slider"} disabled={!canCompare} onClick={() => setComparisonView("slider")}>Arrastar</ToggleButton>
                  <ToggleButton selected={comparisonView === "side-by-side"} disabled={!canCompare} onClick={() => setComparisonView("side-by-side")}>Lado a lado</ToggleButton>
                </div>
              </div>
              <div className={styles.imageStage}>
                <div className={styles.zoomCanvas} style={{ width: `${zoom}%`, height: `${zoom}%` }}>
                  {comparisonView === "side-by-side" && canCompare ? (
                    <div className={styles.sideBySide}>
                      <div><SafeImage src={baseImageUrl} alt="Antes: imagem base" className={styles.viewerImage} /><span className={styles.beforeLabel}>Antes · Base usada</span></div>
                      <div><SafeImage src={jobResultImageUrl} alt="Depois: composição gerada" className={styles.viewerImage} /><span className={styles.afterLabel}>Depois · Nova imagem</span></div>
                    </div>
                  ) : (
                    <>
                      <SafeImage src={resultImageUrl} alt={jobResultImageUrl ? "Depois: composição gerada" : "Imagem base"} className={styles.viewerImage} draggable={false} fallbackLabel="Imagem indisponível" fallbackHint="Esta composição ainda não tem uma imagem para exibir." />
                      {canCompare ? <>
                        <div className={styles.beforeImage} style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}><SafeImage src={baseImageUrl} alt="Antes: imagem base" className={styles.viewerImage} draggable={false} /></div>
                        <span className={styles.beforeLabel}>Antes · Base usada</span><span className={styles.afterLabel}>Depois · Nova imagem</span>
                        <div className={styles.divider} style={{ left: `${sliderPos}%` }}><span><ArrowLeftRight size={21} /></span></div>
                        <Input className={styles.comparisonRange} aria-label="Comparar antes e depois" type="range" min={0} max={100} value={sliderPos} onChange={(event) => setSliderPos(Number(event.target.value))} />
                      </> : <span className={styles.beforeLabel}>{jobResultImageUrl ? "Imagem gerada" : "Base usada"}</span>}
                    </>
                  )}
                </div>
              </div>
              <div className={styles.zoomControls}>
                <div><Button variant="ghost" size="icon" type="button"  aria-label="Diminuir zoom" disabled={zoom <= 100} onClick={() => setZoom((value) => Math.max(100, value - 25))}><Minus size={18} /></Button><Button variant="outline" type="button" aria-label="Restaurar zoom" onClick={() => setZoom(100)}>{zoom}%</Button><Button variant="ghost" size="icon" type="button"  aria-label="Aumentar zoom" disabled={zoom >= 200 || !resultImageUrl} onClick={() => setZoom((value) => Math.min(200, value + 25))}><Plus size={18} /></Button></div>
                <ToggleButton selected={expanded} aria-label={expanded ? "Mostrar detalhes" : "Ampliar comparação"} onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize size={20} /> : <Maximize size={20} />}</ToggleButton>
              </div>
              <p className={styles.comparisonHint}>{canCompare ? "Arraste o controle para comparar a imagem original com o resultado." : "A comparação estará disponível quando houver imagem base e resultado."}</p>
            </section>
            {!expanded && <aside className={styles.viewerDetails}>
              <section><h3>Detalhes da composição</h3><dl>
                <div><dt>Cliente</dt><dd>{job.contactName || "Studio"}</dd></div>
                {job.contactPhone && <div><dt>Telefone</dt><dd>{job.contactPhone}</dd></div>}
                <div><dt>ID do processo</dt><dd className={styles.copyId}>{job.id.slice(0, 8)}<Button variant="ghost" size="icon" type="button"  aria-label="Copiar ID do processo" onClick={async () => { try { await navigator.clipboard.writeText(job.id); setShareSuccess("ID do processo copiado.") } catch { setDownloadError("Não foi possível copiar o ID.") } }}><Copy size={16} /></Button></dd></div>
                <div><dt>Modo</dt><dd><span className={styles.category}>{modeLabels[job.mode]}</span></dd></div>
                <div><dt>Origem</dt><dd>{job.source === "ai" ? "IA" : "Operador"}</dd></div>
              </dl></section>
              <section><h3>Processamento</h3><dl>
                <div><dt>Criado em</dt><dd>{formatJobTime(job.createdAt)}</dd></div>
                <div><dt>Iniciado em</dt><dd>{formatJobTime(job.startedAt)}</dd></div>
                <div><dt>Finalizado em</dt><dd>{formatJobTime(job.completedAt)}</dd></div>
                <div><dt>Tentativas</dt><dd>{job.processingAttempts}</dd></div>
              </dl></section>
              <section><h3>Instruções utilizadas</h3><p className={styles.instructions}>{job.prompt || "Nenhuma instrução registrada."}</p></section>
              {job.errorMessage && <section><h3>Falha registrada</h3><p className={styles.failure}>{formatCompositionError(job.errorMessage)}</p></section>}
              {(job.status === "queued" || job.status === "failed") && <Button className={styles.download} disabled={isProcessing === job.id} onClick={() => onProcess(job.id)}>{isProcessing === job.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Processar agora</Button>}
            </aside>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
