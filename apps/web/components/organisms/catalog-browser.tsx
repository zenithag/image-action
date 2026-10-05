"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api"
import type { CatalogItem } from "@studio/contracts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const tagFields = ["cor", "material", "estilo", "marca"] as const

export function CatalogBrowser({ tenantId }: { tenantId?: string }) {
  const { data: session } = useSession()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)

  async function loadItems() {
    const params = new URLSearchParams()
    if (tenantId) params.set("tenant_id", tenantId)
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(`tag_${k}`, v)
    }
    try {
      const data = await apiFetch<CatalogItem[]>(`/v1/catalog/items?${params}`, {
        accessToken: session?.accessToken,
      })
      setItems(data)
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    loadItems()
  }, [session?.accessToken, tenantId])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Catalogo</h1>
        <p className="text-sm text-muted-foreground">Navegue e filtre items do catalogo do tenant.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {tagFields.map((field) => (
          <Input
            key={field}
            placeholder={`Filtrar por ${field}`}
            value={filters[field] || ""}
            onChange={(e) => setFilters((f) => ({ ...f, [field]: e.target.value }))}
            className="w-44"
          />
        ))}
        <Button onClick={loadItems} size="sm">
          Filtrar
        </Button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription className="line-clamp-2">{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(item.tags || {}).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
              {item.sku && (
                <p className="mt-2 text-xs text-muted-foreground">SKU: {item.sku}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Nenhum item encontrado.
          </p>
        )}
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{selectedItem.name}</CardTitle>
            <CardDescription>{selectedItem.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><strong>SKU:</strong> {selectedItem.sku || "N/A"}</p>
            <p className="text-sm"><strong>Status:</strong> {selectedItem.status}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(selectedItem.tags || {}).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
