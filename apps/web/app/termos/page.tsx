import type { Metadata } from "next"

import { LegalPlaceholderPage } from "@/components/site/legal-placeholder-page"

// noindex: página placeholder, sem texto de política real (Guia, 4.1 —
// "Publicar somente após aprovação jurídica e técnica"). Remover o robots
// quando o texto final entrar no ar.
export const metadata: Metadata = {
  title: "Termos de uso - ComoFica.ai",
  description: "Termos de uso do site e das demonstrações públicas da ComoFica.ai — em finalização com o time jurídico.",
  alternates: { canonical: "/termos" },
  robots: { index: false, follow: true },
}

export default function Page() {
  return (
    <LegalPlaceholderPage
      eyebrow="Termos de uso"
      title="As regras de uso do site e das demonstrações da ComoFica.ai"
      subheadline="Estamos formalizando estes termos com nosso time jurídico antes de publicá-los na íntegra."
      scopeNote="Esta página vai reunir as regras de uso do site e das demonstrações públicas oferecidas pela ComoFica.ai."
    />
  )
}
