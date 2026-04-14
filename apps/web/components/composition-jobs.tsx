"use client"

import { useState, useRef } from "react"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CompositionJob {
  id: string
  mode: "interior" | "product" | "print" | "fashion"
  status: "queued" | "processing" | "done" | "failed"
  contact: string
  catalogItem: string
  createdAt: string
  completedAt?: string
  baseImage: string
  resultImage?: string
  errorMessage?: string
}

const mockJobs: CompositionJob[] = [
  {
    id: "1",
    mode: "interior",
    status: "done",
    contact: "Maria Silva",
    catalogItem: "Tinta Azul Petróleo",
    createdAt: "14:35",
    completedAt: "14:36",
    baseImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=150&h=150&fit=crop",
    resultImage: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=150&h=150&fit=crop",
  },
  {
    id: "2",
    mode: "interior",
    status: "processing",
    contact: "Pedro Oliveira",
    catalogItem: "Piso Vinílico Madeira",
    createdAt: "14:40",
    baseImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=150&h=150&fit=crop",
  },
  {
    id: "3",
    mode: "product",
    status: "queued",
    contact: "Ana Costa",
    catalogItem: "Caneca Personalizada",
    createdAt: "14:42",
    baseImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
  },
  {
    id: "4",
    mode: "interior",
    status: "failed",
    contact: "Carlos Santos",
    catalogItem: "Revestimento 3D Wave",
    createdAt: "14:30",
    baseImage: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=150&h=150&fit=crop",
    errorMessage: "Falha ao processar imagem base: qualidade insuficiente",
  },
  {
    id: "5",
    mode: "interior",
    status: "done",
    contact: "Julia Ferreira",
    catalogItem: "Tinta Azul Serenity",
    createdAt: "14:20",
    completedAt: "14:21",
    baseImage: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=150&h=150&fit=crop",
    resultImage: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=150&h=150&fit=crop",
  },
]

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
    label: "Concluído",
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
  fashion: "Vestuário",
}

export function CompositionJobs() {
  const [viewingJob, setViewingJob] = useState<CompositionJob | null>(null)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">Jobs de Composição</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Acompanhe o processamento das composições visuais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-sans rounded-[5px] shadow-none">
            <RotateCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-border px-6 py-6 bg-card/30">
        {[
          { label: "Na Fila", value: 1, color: "text-warning", bg: "bg-warning/10" },
          { label: "Processando", value: 1, color: "text-primary", bg: "bg-primary/10" },
          { label: "Concluídos", value: 2, color: "text-primary", bg: "bg-primary/10" },
          { label: "Falhas", value: 1, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[5px] border border-border bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-sans">{stat.label}</p>
            <p className={cn("mt-2 text-3xl font-bold font-display", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-6xl mx-auto space-y-4">
          {mockJobs.map((job) => {
            const status = statusConfig[job.status]
            const StatusIcon = status.icon

            return (
              <div
                key={job.id}
                className="group flex items-center gap-6 rounded-[5px] border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md"
              >
                {/* Base Image */}
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[5px] bg-muted border border-border">
                  <img
                    src={job.baseImage}
                    alt="Imagem base"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute top-1 left-1 bg-black/50 text-[8px] text-white px-1 rounded uppercase">Base</div>
                </div>

                {/* Job Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-card-foreground font-display text-base">{job.contact}</h4>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        status.className
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          "h-3 w-3",
                          job.status === "processing" && "animate-spin"
                        )}
                      />
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-foreground font-sans">
                    <span className="text-primary font-semibold">{job.catalogItem}</span>
                    <span className="mx-2 text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{modeLabels[job.mode]}</span>
                  </p>

                  {job.errorMessage && (
                    <p className="mt-2 text-xs text-destructive font-medium border-l-2 border-destructive pl-2">{job.errorMessage}</p>
                  )}

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground font-sans">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> Criado: {job.createdAt}</span>
                    {job.completedAt && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary"/> Concluído: {job.completedAt}</span>}
                  </div>
                </div>

                {/* Result Image */}
                {job.resultImage ? (
                  <div 
                    onClick={() => setViewingJob(job)}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[5px] bg-muted border border-border group/result cursor-pointer"
                  >
                    <img
                      src={job.resultImage}
                      alt="Resultado"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 transition-opacity group-hover/result:opacity-100 backdrop-blur-[2px]">
                      <Eye className="h-6 w-6 text-white drop-shadow-md" />
                    </div>
                    <div className="absolute top-1 left-1 bg-primary/80 text-[8px] text-white px-1 rounded uppercase">Novo</div>
                  </div>
                ) : (
                   <div className="h-20 w-20 shrink-0 border-2 border-dashed border-border rounded-[5px] flex items-center justify-center bg-muted/30">
                     <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                   </div>
                )}

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2 ml-4">
                  {job.status === "done" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setViewingJob(job)}
                      className="font-sans rounded-[5px] border-primary/20 text-primary hover:bg-primary/10"
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      Visualizar
                    </Button>
                  )}
                  {job.status === "failed" && (
                    <Button variant="outline" size="sm" className="font-sans rounded-[5px] border-destructive/20 text-destructive hover:bg-destructive/10">
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Tentar novamente
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {viewingJob && (
        <CompositionViewerModal 
          job={viewingJob} 
          onClose={() => setViewingJob(null)} 
        />
      )}
    </div>
  )
}

function CompositionViewerModal({ job, onClose }: { job: CompositionJob; onClose: () => void }) {
  const [sliderPos, setSliderPos] = useState(50)
  const isResizing = useRef(false)

  const handleMouseDown = () => { isResizing.current = true }
  const handleMouseUp = () => { isResizing.current = false }
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isResizing.current) return
    const container = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const position = ((x - container.left) / container.width) * 100
    setSliderPos(Math.max(0, Math.min(100, position)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="relative w-full max-w-5xl rounded-[10px] bg-card overflow-hidden shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold font-display flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" /> Compartilhado por {job.contact}
            </h2>
            <p className="text-xs text-muted-foreground">{job.catalogItem} • {modeLabels[job.mode]}</p>
          </div>
          <button onClick={onClose} className="rounded-full hover:bg-muted p-2 transition-colors">
            <XCircle className="h-6 w-6 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
          <div className="lg:col-span-3 bg-black relative select-none"
               onMouseMove={handleMouseMove}
               onMouseUp={handleMouseUp}
               onMouseLeave={handleMouseUp}
               onTouchMove={handleMouseMove}
               onTouchEnd={handleMouseUp}
          >
            <div className="relative aspect-video w-full overflow-hidden">
              {/* After Image */}
              <img src={job.resultImage} className="absolute inset-0 h-full w-full object-contain" alt="Resultado" />
              
              {/* Before Image (clipped) */}
              <div 
                className="absolute inset-0 h-full w-full overflow-hidden border-r-2 border-primary"
                style={{ width: `${sliderPos}%` }}
              >
                <img src={job.baseImage} className="absolute inset-0 h-screen lg:h-full w-[max(80vw,500px)] lg:w-[1000px] object-contain max-w-none" alt="Base" />
                <div className="absolute top-4 left-4 bg-black/60 text-[10px] text-white px-2 py-1 rounded-sm uppercase font-bold tracking-widest">Base</div>
              </div>
              
              <div className="absolute top-4 right-4 bg-primary/80 text-[10px] text-white px-2 py-1 rounded-sm uppercase font-bold tracking-widest">Resultado</div>

              {/* Slider Handle */}
              <div 
                className="absolute inset-y-0 z-10 cursor-ew-resize group"
                style={{ left: `${sliderPos}%` }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-primary border-4 border-white shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="flex gap-0.5">
                    <div className="h-2 w-0.5 bg-white" />
                    <div className="h-2 w-0.5 bg-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-l border-border p-6 bg-card flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Informações</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">ID do Job</span><span className="font-mono">{job.id}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status</span><span className="text-primary font-bold">Concluído</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Concluído em</span><span>{job.completedAt}</span></div>
                </div>
              </div>
              <div className="p-4 rounded-[5px] bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  "A composição visual foi gerada utilizando IA generativa para integrar {job.catalogItem} em um ambiente de {modeLabels[job.mode]}."
                </p>
              </div>
            </div>

            <div className="space-y-3 mt-8">
              <Button className="w-full font-sans py-6 rounded-[5px]">
                Download Resultado
              </Button>
              <Button variant="outline" className="w-full font-sans py-6 rounded-[5px]">
                Compartilhar via WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
