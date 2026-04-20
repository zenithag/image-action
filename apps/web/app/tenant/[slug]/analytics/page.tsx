"use client"

import { use } from "react"

import { TenantAnalyticsView } from "@/components/tenant-analytics-view"

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div className="h-full overflow-hidden">
      <TenantAnalyticsView tenantSlug={slug} />
    </div>
  )
}
