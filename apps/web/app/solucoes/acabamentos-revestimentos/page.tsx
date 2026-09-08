import type { Metadata } from "next"

import { SolutionPage } from "@/components/site/solution-page"
import { ACABAMENTOS_CONTENT } from "@/lib/solutions-content"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Visualizador de pisos e revestimentos - ComoFica.ai"
const description = "Mostre pisos, revestimentos, pedras e tintas no ambiente real do cliente pelo painel, site e WhatsApp da empresa."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/solucoes/acabamentos-revestimentos" },
  ...pageSocialMetadata("/solucoes/acabamentos-revestimentos", title, description),
}

export default function Page() {
  return <SolutionPage content={ACABAMENTOS_CONTENT} />
}
