"use client"

import { use } from "react"
import { CatalogBrowser } from "@/components/catalog-browser"

export default function CatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div className="h-full overflow-hidden">
      <CatalogBrowser tenantSlug={slug} />
    </div>
  )
}
