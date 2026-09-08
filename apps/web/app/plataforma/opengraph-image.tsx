import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("A plataforma ComoFica.ai", "Leve a visualização para o canal onde a decisão acontece.")
}
