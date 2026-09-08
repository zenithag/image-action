import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("ComoFica.ai para moda", "Experiências visuais para moda começam antes do provador.")
}
