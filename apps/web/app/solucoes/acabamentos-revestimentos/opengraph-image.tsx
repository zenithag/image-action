import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("ComoFica.ai para acabamentos e revestimentos", "Faça o cliente ver o produto no próprio ambiente antes de decidir.")
}
