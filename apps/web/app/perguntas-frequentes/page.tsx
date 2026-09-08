import type { Metadata } from "next"

import { FaqPage } from "@/components/site/faq-page"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Perguntas frequentes sobre a ComoFica.ai"
const description =
  "Entenda como funcionam as simulações, os canais, o catálogo, os usuários, as integrações, os limites e a contratação da ComoFica.ai."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/perguntas-frequentes" },
  ...pageSocialMetadata("/perguntas-frequentes", title, description),
}

export default function Page() {
  return <FaqPage />
}
