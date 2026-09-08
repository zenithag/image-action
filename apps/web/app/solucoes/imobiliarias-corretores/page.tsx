import type { Metadata } from "next"

import { SolutionPage } from "@/components/site/solution-page"
import { IMOBILIARIAS_CONTENT } from "@/lib/solutions-content"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Visualização de imóveis com IA - ComoFica.ai"
const description = "Mostre imóveis mobiliados, reformados ou adaptados durante a visita, no site e no WhatsApp, com a marca da imobiliária."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/solucoes/imobiliarias-corretores" },
  ...pageSocialMetadata("/solucoes/imobiliarias-corretores", title, description),
}

export default function Page() {
  return <SolutionPage content={IMOBILIARIAS_CONTENT} />
}
