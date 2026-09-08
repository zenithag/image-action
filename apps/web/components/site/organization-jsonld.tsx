import { SITE_URL } from "@/lib/site-config"

/**
 * JSON-LD Organization (Guia, cap. 14.2) — só campos confirmados (nome, url,
 * logo). Sem endereço, telefone ou redes sociais não confirmados.
 */
export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ComoFica.ai",
    url: SITE_URL,
    logo: `${SITE_URL}/logo-horizontal-azul.svg`,
    description:
      "Plataforma de visualização comercial com inteligência artificial que mostra como produtos, acabamentos e ideias podem ficar em ambientes reais antes da decisão.",
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}
