"use client"

import { use } from "react"
import { WhatsAppConnection } from "@/components/whatsapp-connection"

export default function WhatsAppPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div className="h-full overflow-hidden">
      <WhatsAppConnection tenantSlug={slug} />
    </div>
  )
}
