"use client"

import { useParams } from "next/navigation"
import { ArrowLeft, Edit2, Trash2, Share2, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppSidebar } from "@/components/app-sidebar"
import Link from "next/link"

const mockProduct = {
  id: "1",
  name: "Camiseta Premium Azul",
  sku: "SHIRT-001-BLU",
  category: "Camisetas",
  price: 89.90,
  description: "Camiseta de alta qualidade em algodão 100%, confortável e durável.",
  images: [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop",
    "https://images.unsplash.com/photo-1552062407-c551eeda4884?w=500&h=500&fit=crop",
  ],
  stock: 156,
  status: "ativo",
  createdAt: "10 de janeiro de 2025",
  updatedAt: "14 de abril de 2025",
  metadata: {
    colors: ["Azul", "Branco", "Preto"],
    sizes: ["P", "M", "G", "GG"],
    totalViews: 1240,
    totalSales: 89,
  },
}

export default function CatalogDetailPage() {
  const params = useParams()
  const productId = params.id

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/tenant/catalog">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{mockProduct.name}</h1>
              <p className="text-sm text-muted-foreground">{mockProduct.sku}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Edit2 className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar
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
            {/* Product Images & Info */}
            <div className="col-span-2 space-y-6">
              {/* Image Gallery */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <img
                      src={mockProduct.images[0]}
                      alt={mockProduct.name}
                      className="h-96 w-full rounded-lg object-cover"
                    />
                    <div className="flex gap-2">
                      {mockProduct.images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Imagem ${idx + 1}`}
                          className="h-20 w-20 cursor-pointer rounded-lg object-cover border border-border hover:border-ring"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações do Produto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Categoria</p>
                      <p className="text-sm font-medium text-foreground">{mockProduct.category}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className="inline-block rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600">
                        Ativo
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cores Disponíveis</p>
                      <div className="mt-1 flex gap-2">
                        {mockProduct.metadata.colors.map((color) => (
                          <span key={color} className="text-xs text-foreground">
                            {color}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tamanhos</p>
                      <div className="mt-1 flex gap-2">
                        {mockProduct.metadata.sizes.map((size) => (
                          <span key={size} className="text-xs text-foreground">
                            {size}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Descrição</p>
                    <p className="text-sm text-foreground">{mockProduct.description}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Pricing */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preço e Estoque</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Preço</p>
                    <p className="text-3xl font-bold text-foreground">
                      R$ {mockProduct.price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Estoque</p>
                    <p className="text-2xl font-bold text-foreground">{mockProduct.stock} unidades</p>
                    <p className="text-xs text-green-600">Em estoque</p>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estatísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Visualizações</p>
                    <p className="text-2xl font-bold text-foreground">{mockProduct.metadata.totalViews}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total de Vendas</p>
                    <p className="text-2xl font-bold text-foreground">{mockProduct.metadata.totalSales}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Button className="w-full" size="lg">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Adicionar ao Catálogo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
