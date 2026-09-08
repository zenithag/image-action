import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("ComoFica.ai para imobiliárias e corretores", "Mostre o potencial do imóvel durante a visita - não dias depois.")
}
