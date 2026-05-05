"use client"

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
    className: "bg-chart-2/20 text-chart-2",
  },
  done: {
    label: "Concluído",
    icon: CheckCircle2,
    className: "bg-success/20 text-success",
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
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Jobs de Composição</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o processamento das composições visuais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 border-b border-border px-6 py-4">
        {[
          { label: "Na Fila", value: 1, color: "text-warning" },
          { label: "Processando", value: 1, color: "text-chart-2" },
          { label: "Concluídos", value: 2, color: "text-success" },
          { label: "Falhas", value: 1, color: "text-destructive" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg bg-card p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {mockJobs.map((job) => {
            const status = statusConfig[job.status]
            const StatusIcon = status.icon

            return (
              <div
                key={job.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
              >
                {/* Base Image */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <img
                    src={job.baseImage}
                    alt="Imagem base"
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Job Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-card-foreground">{job.contact}</h4>
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
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

                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {job.catalogItem} • {modeLabels[job.mode]}
                  </p>

                  {job.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">{job.errorMessage}</p>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Criado: {job.createdAt}</span>
                    {job.completedAt && <span>Concluído: {job.completedAt}</span>}
                  </div>
                </div>

                {/* Result Image */}
                {job.resultImage && (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <img
                      src={job.resultImage}
                      alt="Resultado"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                      <Eye className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {job.status === "done" && (
                    <Button variant="outline" size="sm">
                      <Eye className="mr-1.5 h-4 w-4" />
                      Ver
                    </Button>
                  )}
                  {job.status === "failed" && (
                    <Button variant="outline" size="sm">
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Reprocessar
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
