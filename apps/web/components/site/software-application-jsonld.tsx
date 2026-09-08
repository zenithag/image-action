import { SITE_URL } from "@/lib/site-config"

/**
 * SoftwareApplication JSON-LD (Guia, cap. 14.2: "sem preço se a tabela pública
 * não estiver definida"). Sem `offers`/`aggregateRating` — inventar preço ou
 * nota inexistente é exatamente o tipo de claim que o guia proíbe (cap. 18).
 */
export function SoftwareApplicationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ComoFica.ai",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, WhatsApp",
    url: `${SITE_URL}/plataforma`,
    description:
      "Plataforma de visualização comercial com inteligência artificial, acessível pela plataforma própria, pelo site do parceiro e pelo WhatsApp da empresa.",
    provider: {
      "@type": "Organization",
      name: "ComoFica.ai",
      url: SITE_URL,
    },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
