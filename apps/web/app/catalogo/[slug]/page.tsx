import { notFound } from "next/navigation"

import { PublicCatalogView } from "@/components/public-catalog-view"
import { listCatalogItems } from "@/lib/server/catalog-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { findTenant } from "@/lib/server/tenants-store"

type PageProps = {
  params: Promise<{
    slug: string
  }>
}

function getCatalogImageUrl(slug: string, itemId: string) {
  return `/api/tenant/${encodeURIComponent(slug)}/catalog/items/${encodeURIComponent(itemId)}/image`
}

export default async function PublicCatalogPage({ params }: PageProps) {
  const { slug } = await params
  const tenant = await findTenant(slug)

  if (!tenant || tenant.status !== "active") {
    notFound()
  }

  const [settings, catalogItems] = await Promise.all([
    getTenantSettings(tenant.slug),
    listCatalogItems(tenant.slug),
  ])
  const items = catalogItems.filter((item) => item.status === "active")
  const companyName = settings.general.companyName.trim() || tenant.name
  const description = settings.general.description.trim() ||
    "Veja os produtos disponíveis para simulações visuais pelo ComoFica."
  const primaryColor = settings.branding.primaryColor || "#12849a"

  return (
    <PublicCatalogView
      companyName={companyName}
      description={description}
      primaryColor={primaryColor}
      items={items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        sku: item.sku,
        tags: item.tags,
        imageUrl: getCatalogImageUrl(tenant.slug, item.id),
        productUrl: `/catalogo/${encodeURIComponent(tenant.slug)}/produto/${encodeURIComponent(item.id)}`,
      }))}
    />
  )
}
