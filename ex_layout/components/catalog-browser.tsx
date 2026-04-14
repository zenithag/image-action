"use client"

import { useState } from "react"
import { Search, Filter, Plus, MoreVertical, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CatalogItem {
  id: string
  name: string
  description: string
  category: string
  sku?: string
  status: "active" | "inactive"
  tags: Record<string, string>
  image: string
}

const mockCategories = [
  { id: "all", name: "Todos", count: 24 },
  { id: "tintas", name: "Tintas", count: 8 },
  { id: "revestimentos", name: "Revestimentos", count: 6 },
  { id: "pisos", name: "Pisos", count: 5 },
  { id: "moveis", name: "Móveis", count: 3 },
  { id: "objetos", name: "Objetos", count: 2 },
]

const mockItems: CatalogItem[] = [
  {
    id: "1",
    name: "Tinta Azul Petróleo",
    description: "Tom profundo e elegante para ambientes sofisticados",
    category: "Tintas",
    sku: "TIN-001",
    status: "active",
    tags: { cor: "Azul", acabamento: "Fosco", marca: "Suvinil" },
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop",
  },
  {
    id: "2",
    name: "Tinta Azul Serenity",
    description: "Tom suave e relaxante para quartos e salas",
    category: "Tintas",
    sku: "TIN-002",
    status: "active",
    tags: { cor: "Azul Claro", acabamento: "Acetinado", marca: "Coral" },
    image: "https://images.unsplash.com/photo-1525909002-1b05e0c869d8?w=200&h=200&fit=crop",
  },
  {
    id: "3",
    name: "Porcelanato Carrara",
    description: "Porcelanato polido que reproduz o mármore italiano",
    category: "Pisos",
    sku: "PIS-001",
    status: "active",
    tags: { cor: "Branco", material: "Porcelanato", dimensao: "60x120cm" },
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=200&h=200&fit=crop",
  },
  {
    id: "4",
    name: "Revestimento 3D Wave",
    description: "Revestimento tridimensional para paredes de destaque",
    category: "Revestimentos",
    sku: "REV-001",
    status: "active",
    tags: { cor: "Branco", material: "Gesso", estilo: "Moderno" },
    image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?w=200&h=200&fit=crop",
  },
  {
    id: "5",
    name: "Sofá Modular Cinza",
    description: "Sofá modular em tecido suede com configuração flexível",
    category: "Móveis",
    sku: "MOV-001",
    status: "active",
    tags: { cor: "Cinza", material: "Suede", estilo: "Contemporâneo" },
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop",
  },
  {
    id: "6",
    name: "Piso Vinílico Madeira",
    description: "Piso vinílico que reproduz madeira natural",
    category: "Pisos",
    sku: "PIS-002",
    status: "active",
    tags: { cor: "Madeira", material: "Vinílico", dimensao: "20x120cm" },
    image: "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=200&h=200&fit=crop",
  },
]

export function CatalogBrowser() {
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredItems = mockItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === "all" ||
      item.category.toLowerCase() === selectedCategory.toLowerCase()
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Catálogo de Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os itens disponíveis para composição visual
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Item
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4 border-b border-border px-6 py-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-input bg-input py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filtros
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Categories Sidebar */}
        <div className="w-56 border-r border-border p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categorias
          </h3>
          <nav className="space-y-1">
            {mockCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  selectedCategory === category.id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <span>{category.name}</span>
                <span className="text-xs">{category.count}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <button className="absolute right-2 top-2 rounded-lg bg-background/80 p-1.5 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <MoreVertical className="h-4 w-4 text-foreground" />
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-card-foreground">{item.name}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        item.status === "active"
                          ? "bg-success/20 text-success"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {Object.entries(item.tags)
                      .slice(0, 3)
                      .map(([key, value]) => (
                        <span
                          key={key}
                          className="flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {value}
                        </span>
                      ))}
                  </div>

                  {item.sku && (
                    <p className="mt-3 text-xs text-muted-foreground">SKU: {item.sku}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
