"use client"

import { useParams } from "next/navigation"
import { ArrowLeft, Download, RefreshCw, ZoomIn, Copy, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppSidebar } from "@/components/app-sidebar"
import Link from "next/link"

const mockComposition = {
  id: "1",
  name: "Banner Promocional - Black Friday",
  status: "concluído",
  createdAt: "14 de abril de 2025, 14:35",
  completedAt: "14 de abril de 2025, 14:38",
  prompt: "Crie um banner promocional para Black Friday com cores pretas e douradas, mostrando desconto de 50%",
  resultImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop",
  resultSize: "1200x900px",
  fileSize: "2.4 MB",
  model: "Stable Diffusion XL",
  metadata: {
    processingTime: "3 minutos 15 segundos",
    quality: "Excelente",
    variations: 3,
    downloadCount: 2,
  },
}

export default function CompositionDetailPage() {
  const params = useParams()
  const compositionId = params.id

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/tenant/compositions">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{mockComposition.name}</h1>
              <p className="text-sm text-muted-foreground">{mockComposition.createdAt}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerar
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Main Image */}
            <div className="col-span-2 space-y-6">
              {/* Image Preview */}
              <Card>
                <CardContent className="p-6">
                  <div className="group relative overflow-hidden rounded-lg bg-card">
                    <img
                      src={mockComposition.resultImage}
                      alt={mockComposition.name}
                      className="h-96 w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <button className="absolute right-4 top-4 rounded-lg bg-background/80 p-2 backdrop-blur hover:bg-background">
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalhes da Composição</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">PROMPT ORIGINAL</p>
                    <p className="mt-2 rounded-lg bg-card p-3 text-sm text-foreground">{mockComposition.prompt}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Modelo IA</p>
                      <p className="text-sm font-medium text-foreground">{mockComposition.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className="inline-block rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                        Concluído
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo de Processamento</p>
                      <p className="text-sm font-medium text-foreground">{mockComposition.metadata.processingTime}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Qualidade</p>
                      <p className="text-sm font-medium text-foreground">{mockComposition.metadata.quality}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Variations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Variações</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="group relative overflow-hidden rounded-lg">
                        <img
                          src={`https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=300&h=300&fit=crop&blur=10&q=${100 - idx * 20}`}
                          alt={`Variação ${idx}`}
                          className="aspect-square object-cover"
                        />
                        <button className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <ZoomIn className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* File Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações do Arquivo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Resolução</p>
                    <p className="text-sm font-medium text-foreground">{mockComposition.resultSize}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tamanho</p>
                    <p className="text-sm font-medium text-foreground">{mockComposition.fileSize}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Concluído em</p>
                    <p className="text-sm font-medium text-foreground">{mockComposition.completedAt}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estatísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Downloads</p>
                    <p className="text-2xl font-bold text-foreground">{mockComposition.metadata.downloadCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Variações Geradas</p>
                    <p className="text-2xl font-bold text-foreground">{mockComposition.metadata.variations}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="space-y-2">
                <Button className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Imagem
                </Button>
                <Button className="w-full" variant="outline" size="lg">
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
