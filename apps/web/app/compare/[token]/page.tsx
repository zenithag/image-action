import { notFound } from "next/navigation"

import { PublicComparisonView } from "@/components/public-comparison-view"
import { getCompositionBaseImageUrl } from "@/lib/composition-image-url"
import { findCompositionJobByShareToken } from "@/lib/server/composition-jobs-store"

type PageProps = {
  params: Promise<{
    token: string
  }>
}

export default async function PublicComparisonPage({ params }: PageProps) {
  const { token } = await params
  const job = await findCompositionJobByShareToken(token)
  const baseImageUrl = job ? getCompositionBaseImageUrl(job) : undefined

  if (!job || !baseImageUrl || !job.resultImageUrl || job.status !== "done") {
    notFound()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,1))]">
      <PublicComparisonView
        title={job.catalogItemName || "Comparação de composição"}
        subtitle={`Comparativo da composição gerada para ${job.contactName} no tenant ${job.tenantSlug}.`}
        baseImageUrl={baseImageUrl}
        resultImageUrl={job.resultImageUrl}
      />
    </main>
  )
}
