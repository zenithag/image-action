import type { Metadata } from "next"

import { SITE_NAME, SITE_URL } from "@/lib/site-config"

/**
 * Open Graph + Twitter card comuns a toda página com conteúdo pronto pra
 * compartilhar (Guia, cap. 14.1). A imagem vem do arquivo `opengraph-image.*`
 * da própria rota (convenção do Next) — não precisa ser listada aqui.
 *
 * `ogDescription` é opcional e serve só pra descolar o texto do card social
 * (mais chamativo, sem compromisso com SEO) da meta description real, que
 * é a copy aprovada no guia e não deve mudar por causa disso.
 */
export function pageSocialMetadata(
  path: string,
  title: string,
  description: string,
  ogDescription?: string
): Pick<Metadata, "openGraph" | "twitter"> {
  const url = `${SITE_URL}${path}`
  const socialDescription = ogDescription ?? description

  return {
    openGraph: {
      title,
      description: socialDescription,
      url,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: socialDescription,
    },
  }
}
