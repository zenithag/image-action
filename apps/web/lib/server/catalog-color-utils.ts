import type { CatalogItem } from "@/lib/catalog-types"

export type CatalogColorReference = {
  item: CatalogItem
  colors: string[]
  matchedTerms: string[]
}

const colorKeywords: Record<string, string[]> = {
  azul: ["azul", "blue"],
  cinza: ["cinza", "grey", "gray", "grafite"],
  verde: ["verde", "green"],
  vermelho: ["vermelho", "red"],
  amarelo: ["amarelo", "yellow"],
  branco: ["branco", "white"],
  preto: ["preto", "black"],
  bege: ["bege", "beige"],
  marrom: ["marrom", "brown"],
  rosa: ["rosa", "pink"],
  roxo: ["roxo", "purple", "violeta"],
  laranja: ["laranja", "orange"],
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function normalizeColorValue(value: string) {
  return normalizeText(value).replace(/\s+/g, "")
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export function extractColorValuesFromCatalogItem(item: CatalogItem) {
  const source = [
    item.name,
    item.description,
    item.category,
    ...Object.entries(item.tags).flatMap(([key, value]) => [key, value]),
  ].join("\n")
  const hex = source.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g) ?? []
  const rgb = source.match(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/gi) ?? []
  const cmyk = source.match(/cmyk\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*\)/gi) ?? []

  return unique([...hex, ...rgb, ...cmyk])
}

export function findCatalogColorReferences(items: CatalogItem[], text: string, limit = 4): CatalogColorReference[] {
  const normalizedText = normalizeText(text)
  const requestedColorTerms = Object.entries(colorKeywords)
    .filter(([, terms]) => terms.some((term) => normalizedText.includes(term)))
    .flatMap(([, terms]) => terms)
  const requestedColorValues = unique([
    ...(text.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g) ?? []),
    ...(text.match(/rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/gi) ?? []),
    ...(text.match(/cmyk\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*\)/gi) ?? []),
  ])

  if (requestedColorTerms.length === 0 && requestedColorValues.length === 0) {
    return []
  }

  const references = items
    .filter((item) => item.status === "active")
    .map((item) => {
      const searchable = normalizeText([
        item.name,
        item.description,
        item.category,
        ...Object.entries(item.tags).flatMap(([key, value]) => [key, value]),
      ].join(" "))
      const searchableColorText = normalizeColorValue(searchable)
      const colors = extractColorValuesFromCatalogItem(item)
      const matchedTerms = unique([
        ...requestedColorTerms.filter((term) => searchable.includes(term)),
        ...requestedColorValues.filter((value) => searchableColorText.includes(normalizeColorValue(value))),
        ...Object.keys(colorKeywords).filter((term) => normalizedText.includes(term) && searchable.includes(term)),
      ])
      const score = matchedTerms.length > 0
        ? matchedTerms.length * 10 + colors.length * 3 + (searchable.includes("tinta") ? 2 : 0)
        : 0

      return { item, colors, matchedTerms, score }
    })
    .filter((reference) => reference.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)

  return references.map(({ item, colors, matchedTerms }) => ({ item, colors, matchedTerms }))
}

export function formatCatalogColorReferences(references: CatalogColorReference[]) {
  return references.map((reference, index) => {
    const colorText = reference.colors.length > 0 ? ` (${reference.colors.join(", ")})` : ""
    const skuText = reference.item.sku ? ` SKU ${reference.item.sku}` : ""

    return `${index + 1}. ${reference.item.name}${colorText}${skuText} - ${reference.item.description}`
  }).join("\n")
}

export function getPrimaryCatalogColor(reference?: CatalogColorReference | null) {
  return reference?.colors[0]
}
