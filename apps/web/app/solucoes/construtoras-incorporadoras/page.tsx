import type { Metadata } from "next"

import { SolutionPage } from "@/components/site/solution-page"
import { CONSTRUTORAS_CONTENT } from "@/lib/solutions-content"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Visualização com IA para construtoras - ComoFica.ai"
const description =
  "Ajude compradores a visualizar acabamentos, personalizações e ambientes pelo stand, site e WhatsApp, com a marca da construtora."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/solucoes/construtoras-incorporadoras" },
  ...pageSocialMetadata("/solucoes/construtoras-incorporadoras", title, description),
}

export default function Page() {
  return <SolutionPage content={CONSTRUTORAS_CONTENT} />
}
