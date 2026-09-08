import type { Metadata } from "next"

import { LegalPlaceholderPage } from "@/components/site/legal-placeholder-page"

// noindex: página placeholder, sem texto de política real (Guia, 4.1 —
// "Publicar somente após aprovação jurídica e técnica"). Remover o robots
// quando o texto final entrar no ar.
export const metadata: Metadata = {
  title: "Política de privacidade - ComoFica.ai",
  description: "Política de privacidade da ComoFica.ai — em finalização com o time jurídico.",
  alternates: { canonical: "/privacidade" },
  robots: { index: false, follow: true },
}

export default function Page() {
  return (
    <LegalPlaceholderPage
      eyebrow="Política de privacidade"
      title="Como cuidamos dos dados que passam pela ComoFica.ai"
      subheadline="Estamos formalizando esta política com nosso time jurídico antes de publicá-la na íntegra."
      scopeNote="Esta página vai reunir como coletamos, usamos, armazenamos e protegemos dados de clientes, parceiros e visitantes."
    />
  )
}
