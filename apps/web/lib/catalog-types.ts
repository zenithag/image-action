export type CatalogItemStatus = "active" | "inactive"

export type CatalogItem = {
  id: string
  tenantSlug: string
  name: string
  description: string
  category: string
  sku?: string
  status: CatalogItemStatus
  tags: Record<string, string>
  imageUrl: string
  createdAt: string
  updatedAt: string
}

export type CatalogItemInput = {
  name: string
  description: string
  category: string
  sku?: string
  status?: CatalogItemStatus
  tags?: Record<string, string>
  imageUrl?: string
}
