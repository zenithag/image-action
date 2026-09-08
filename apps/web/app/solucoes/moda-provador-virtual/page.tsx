import type { Metadata } from "next"

import { ModaPage } from "@/components/site/moda-page"
import { pageSocialMetadata } from "@/lib/seo"

const title = "Projetos de visualização para moda - ComoFica.ai"
const description =
  "Converse com a ComoFica.ai sobre projetos de visualização de peças e combinações, com escopo técnico, privacidade e transparência definidos."

// noindex: Guia cap. 20.7 — "Moda/provador virtual após decisão explícita
// sobre indexação e oferta". A página existe e é navegável (link no menu
// "Soluções" e no rodapé), mas não deve competir por ranqueamento com os
// quatro ICPs prioritários até o John decidir publicá-la com esse status.
// O Open Graph continua completo (image + card) porque isso vale pra
// compartilhamento direto do link, independente de indexação em buscador.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/solucoes/moda-provador-virtual" },
  robots: { index: false, follow: true },
  ...pageSocialMetadata("/solucoes/moda-provador-virtual", title, description),
}

export default function Page() {
  return <ModaPage />
}
