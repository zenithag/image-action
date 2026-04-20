"use client"

import { use } from "react"
import { CompositionJobs } from "@/components/composition-jobs"

export default function CompositionsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  return (
    <div className="h-full overflow-hidden">
      <CompositionJobs tenantSlug={slug} />
    </div>
  )
}
