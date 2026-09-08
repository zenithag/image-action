import type { Metadata } from "next"

import { ContatoPage } from "@/components/site/contato-page"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Contato - ComoFica.ai"
const description = "Agende uma demonstração da ComoFica.ai pelo WhatsApp ou por um formulário rápido."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contato" },
  ...pageSocialMetadata("/contato", title, description),
}

export default function Page() {
  return <ContatoPage />
}
