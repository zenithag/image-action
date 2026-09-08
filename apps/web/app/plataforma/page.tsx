import type { Metadata } from "next"

import { PlatformPage } from "@/components/site/platform-page"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Plataforma de visualização com IA - ComoFica.ai"
const description =
  "Conheça a plataforma ComoFica.ai: simulações visuais pela plataforma, no site e no WhatsApp, com white label, catálogo, equipe e analytics."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/plataforma" },
  ...pageSocialMetadata("/plataforma", title, description),
}

export default function Page() {
  return <PlatformPage />
}
