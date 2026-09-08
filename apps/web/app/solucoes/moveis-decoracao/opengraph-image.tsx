import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("ComoFica.ai para móveis e decoração", 'Tire o "será que combina?" do caminho da escolha.')
}
