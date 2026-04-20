"use client"

import { use } from "react"

import { TenantContactsManager } from "@/components/tenant-contacts-manager"

export default function ContactsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div className="h-full overflow-hidden">
      <TenantContactsManager tenantSlug={slug} />
    </div>
  )
}
