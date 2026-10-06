import { notFound } from "next/navigation"
import { CatalogBrowser } from "@/components/catalog-browser"
import { getTenantCatalogAccess } from "@/lib/server/tenant-catalog-access"
export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!(await getTenantCatalogAccess(slug)).enabled) notFound()
  return <div className="h-full overflow-hidden"><CatalogBrowser tenantSlug={slug} /></div>
}
