import { ogImageContentType, ogImageSize, renderOgImage } from "@/lib/og-image"

export const size = ogImageSize
export const contentType = ogImageContentType

export default function Image() {
  return renderOgImage("Central de ajuda", "Entenda como funcionam as simulações, os canais, o catálogo e os limites.")
}
