import sharp from "sharp"

import type { CatalogItem } from "@/lib/catalog-types"
import { extractColorValuesFromCatalogItem } from "@/lib/server/catalog-color-utils"

function isSvgDataImage(value: string) {
  return /^data:image\/svg/i.test(value)
}

function isRasterDataImage(value: string) {
  return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)
}

function isHttpImage(value: string) {
  return /^https?:\/\//i.test(value)
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value
}

function expandHex(hex: string) {
  const value = hex.replace("#", "")

  if (value.length === 3) {
    return `#${value.split("").map((char) => `${char}${char}`).join("")}`
  }

  return `#${value.slice(0, 6)}`
}

function parseRgbColor(value: string) {
  const match = value.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i)

  if (!match) {
    return null
  }

  const [red, green, blue] = match.slice(1, 4).map((item) => Math.max(0, Math.min(255, Number(item))))

  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}

function getCatalogColor(item: CatalogItem) {
  const colorValues = extractColorValuesFromCatalogItem(item)
  const hex = colorValues.find((value) => /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value))

  if (hex) {
    return expandHex(hex)
  }

  const rgb = colorValues.map(parseRgbColor).find(Boolean)

  return rgb ?? null
}

function getTextColor(backgroundHex: string) {
  const value = backgroundHex.replace("#", "")
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

  return luminance > 0.58 ? "#111827" : "#ffffff"
}

async function buildColorReferencePngDataUrl(item: CatalogItem, color: string) {
  const foreground = getTextColor(color)
  const subtitle = item.sku ? `SKU ${item.sku}` : item.category
  const details = [
    item.category,
    ...Object.entries(item.tags || {}).slice(0, 3).map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean).join(" | ")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
      <defs>
        <linearGradient id="paint" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.78"/>
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#111827" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="900" height="620" rx="40" fill="#f8fafc"/>
      <rect x="56" y="56" width="788" height="508" rx="34" fill="#ffffff" filter="url(#softShadow)"/>
      <rect x="96" y="96" width="330" height="330" rx="30" fill="url(#paint)"/>
      <path d="M126 376 C185 335, 232 412, 296 367 S381 361, 396 327" fill="none" stroke="${foreground}" stroke-opacity="0.36" stroke-width="22" stroke-linecap="round"/>
      <circle cx="363" cy="148" r="32" fill="${foreground}" fill-opacity="0.16"/>
      <text x="126" y="492" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#111827">${escapeXml(color.toUpperCase())}</text>
      <text x="470" y="160" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="#111827">${escapeXml(truncate(item.name, 24))}</text>
      <text x="472" y="208" font-family="Arial, sans-serif" font-size="23" font-weight="700" fill="#16a34a">${escapeXml(truncate(subtitle, 34))}</text>
      <text x="472" y="274" font-family="Arial, sans-serif" font-size="24" fill="#374151">${escapeXml(truncate(item.description || "Produto de catalogo", 46))}</text>
      <text x="472" y="318" font-family="Arial, sans-serif" font-size="20" fill="#6b7280">${escapeXml(truncate(details, 54))}</text>
      <rect x="472" y="386" width="232" height="58" rx="29" fill="#111827"/>
      <text x="588" y="423" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="#ffffff">REFERENCIA</text>
      <rect x="720" y="386" width="64" height="58" rx="20" fill="${color}"/>
    </svg>
  `
  const png = await sharp(Buffer.from(svg)).png().toBuffer()

  return `data:image/png;base64,${png.toString("base64")}`
}

export function hasCatalogReferenceImage(item: CatalogItem) {
  return isHttpImage(item.imageUrl) || isRasterDataImage(item.imageUrl) || Boolean(getCatalogColor(item))
}

export async function getCatalogReferenceImageDataUrl(item: CatalogItem) {
  if (isRasterDataImage(item.imageUrl)) {
    return item.imageUrl
  }

  if (item.imageUrl && !isSvgDataImage(item.imageUrl) && item.imageUrl.startsWith("data:image/")) {
    return item.imageUrl
  }

  const color = getCatalogColor(item)

  if (!color) {
    return null
  }

  return buildColorReferencePngDataUrl(item, color)
}
