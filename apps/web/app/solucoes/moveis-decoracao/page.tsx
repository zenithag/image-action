import type { Metadata } from "next"

import { SolutionPage } from "@/components/site/solution-page"
import { MOVEIS_CONTENT } from "@/lib/solutions-content"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Visualização de móveis e decoração com IA - ComoFica.ai"
const description =
  "Ajude clientes a explorar móveis, iluminação e composições no próprio ambiente antes de escolher, pelo site, WhatsApp ou atendimento."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/solucoes/moveis-decoracao" },
  ...pageSocialMetadata("/solucoes/moveis-decoracao", title, description),
}

export default function Page() {
  return <SolutionPage content={MOVEIS_CONTENT} />
}
