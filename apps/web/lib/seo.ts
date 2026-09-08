import type { Metadata } from "next"

import { SITE_NAME, SITE_URL } from "@/lib/site-config"

/**
 * Open Graph + Twitter card comuns a toda página com conteúdo pronto pra
 * compartilhar (Guia, cap. 14.1). A imagem vem do arquivo `opengraph-image.tsx`
 * da própria rota (convenção do Next) — não precisa ser listada aqui.
 */
export function pageSocialMetadata(path: string, title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> {
  const url = `${SITE_URL}${path}`

  return {
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "pt_BR",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}
