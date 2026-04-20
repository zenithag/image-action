"use client"

import { use } from "react"

import { TenantSettingsPanel } from "@/components/tenant-settings-panel"

export default function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div className="h-full overflow-hidden">
      <TenantSettingsPanel tenantSlug={slug} />
    </div>
  )
}
