import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("ComoFica.ai para construtoras e incorporadoras", "Ajude o comprador a enxergar o imóvel antes de tudo estar pronto.")
}
