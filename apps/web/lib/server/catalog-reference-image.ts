import type { CatalogItem } from "@/lib/catalog-types"

function isSvgDataImage(value: string) {
  return /^data:image\/svg/i.test(value)
}

function isRasterDataImage(value: string) {
  return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)
}

function isHttpImage(value: string) {
  return /^https?:\/\//i.test(value)
}

export function hasCatalogReferenceImage(item: CatalogItem) {
  return isHttpImage(item.imageUrl) || isRasterDataImage(item.imageUrl) || Boolean(
    item.imageUrl && !isSvgDataImage(item.imageUrl) && item.imageUrl.startsWith("data:image/")
  )
}

export function getCatalogReferenceImageUrl(item: CatalogItem) {
  if (isRasterDataImage(item.imageUrl)) {
    return item.imageUrl
  }

  if (item.imageUrl && !isSvgDataImage(item.imageUrl) && item.imageUrl.startsWith("data:image/")) {
    return item.imageUrl
  }

  return isHttpImage(item.imageUrl) ? item.imageUrl : null
}
