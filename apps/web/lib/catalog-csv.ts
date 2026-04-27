import type { CatalogItem, CatalogItemInput } from "@/lib/catalog-types"

export type CatalogCsvRow = Record<string, string>

export type CatalogImportPreviewRow = {
  rowNumber: number
  raw: CatalogCsvRow
  normalized: CatalogItemInput | null
  errors: string[]
}

const CSV_HEADERS = [
  "name",
  "category",
  "sku",
  "product_type",
  "usage_mode",
  "description",
  "image_url",
  "status",
  "hex",
  "rgb",
  "hsl",
  "cmyk",
  "attributes",
] as const

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function escapeCsvValue(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`
  }

  return value
}

function parseAttributes(value: string) {
  if (!value.trim()) {
    return {}
  }

  return Object.fromEntries(
    value
      .split(/\r?\n|\||;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...rest] = line.split(":")
        return [normalizeText(key), normalizeText(rest.join(":"))]
      })
      .filter(([key, tagValue]) => key && tagValue),
  )
}

function buildAttributes(item: CatalogItem) {
  return Object.entries(item.tags)
    .filter(([key]) => key !== "product_type" && key !== "usage_mode")
    .map(([key, value]) => `${key}: ${value}`)
    .join(" | ")
}

function getColorValue(item: CatalogItem, key: string) {
  const directTag = item.tags[key]

  if (directTag) {
    return directTag
  }

  const haystack = [
    item.name,
    item.description,
    ...Object.entries(item.tags).flatMap(([tagKey, value]) => [tagKey, value]),
  ].join(" ")

  const regexMap: Record<string, RegExp> = {
    hex: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/,
    rgb: /rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/i,
    hsl: /hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/i,
    cmyk: /cmyk\(\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*,\s*\d{1,3}%?\s*\)/i,
  }

  return haystack.match(regexMap[key])?.[0] ?? ""
}

export function getCatalogCsvHeaders() {
  return [...CSV_HEADERS]
}

export function exportCatalogItemsToCsv(items: CatalogItem[]) {
  const lines = [
    CSV_HEADERS.join(","),
    ...items.map((item) => [
      item.name,
      item.category,
      item.sku ?? "",
      item.tags.product_type ?? "",
      item.tags.usage_mode ?? "",
      item.description,
      item.imageUrl,
      item.status,
      getColorValue(item, "hex"),
      getColorValue(item, "rgb"),
      getColorValue(item, "hsl"),
      getColorValue(item, "cmyk"),
      buildAttributes(item),
    ].map((value) => escapeCsvValue(value)).join(",")),
  ]

  return `${lines.join("\n")}\n`
}

export function parseCsvText(csvText: string) {
  const rows: string[][] = []
  let currentCell = ""
  let currentRow: string[] = []
  let inQuotes = false

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index]
    const nextCharacter = csvText[index + 1]

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        currentCell += "\""
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ""
      continue
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1
      }

      currentRow.push(currentCell)
      if (currentRow.some((value) => value.trim().length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ""
      continue
    }

    currentCell += character
  }

  currentRow.push(currentCell)
  if (currentRow.some((value) => value.trim().length > 0)) {
    rows.push(currentRow)
  }

  return rows
}

export function previewCatalogImport(csvText: string, existingItems: CatalogItem[]) {
  const parsedRows = parseCsvText(csvText)

  if (parsedRows.length === 0) {
    throw new Error("CSV vazio.")
  }

  const [headers, ...dataRows] = parsedRows
  const normalizedHeaders = headers.map((header) => normalizeText(header).toLowerCase())
  const rows = dataRows.map<CatalogImportPreviewRow>((cells, rowIndex) => {
    const raw = Object.fromEntries(
      normalizedHeaders.map((header, cellIndex) => [header, normalizeText(cells[cellIndex])]),
    )

    const errors: string[] = []
    const name = normalizeText(raw.name)
    const category = normalizeText(raw.category)
    const sku = normalizeText(raw.sku)
    const productType = normalizeText(raw.product_type) || "outro"
    const usageMode = normalizeText(raw.usage_mode) || "catalogo"
    const description = normalizeText(raw.description)
    const imageUrl = normalizeText(raw.image_url)
    const status = normalizeText(raw.status) === "inactive" ? "inactive" : "active"
    const tags = {
      ...parseAttributes(normalizeText(raw.attributes)),
      product_type: productType,
      usage_mode: usageMode,
      ...(normalizeText(raw.hex) ? { hex: normalizeText(raw.hex) } : {}),
      ...(normalizeText(raw.rgb) ? { rgb: normalizeText(raw.rgb) } : {}),
      ...(normalizeText(raw.hsl) ? { hsl: normalizeText(raw.hsl) } : {}),
      ...(normalizeText(raw.cmyk) ? { cmyk: normalizeText(raw.cmyk) } : {}),
    }

    if (!name) errors.push("Nome obrigatorio.")
    if (!category) errors.push("Categoria obrigatoria.")

    const duplicateExistingSku = sku && existingItems.some((item) => item.sku?.toLowerCase() === sku.toLowerCase())
    if (duplicateExistingSku) {
      errors.push("SKU ja existente no catalogo.")
    }

    return {
      rowNumber: rowIndex + 2,
      raw,
      normalized: errors.length === 0 ? {
        name,
        category,
        sku: sku || undefined,
        description,
        imageUrl: imageUrl || undefined,
        status,
        tags,
      } : null,
      errors,
    }
  })

  const duplicateSkusInFile = new Set<string>()
  const seenSkus = new Set<string>()

  for (const row of rows) {
    const sku = row.normalized?.sku?.toLowerCase()
    if (!sku) continue
    if (seenSkus.has(sku)) duplicateSkusInFile.add(sku)
    seenSkus.add(sku)
  }

  for (const row of rows) {
    const sku = row.normalized?.sku?.toLowerCase()
    if (sku && duplicateSkusInFile.has(sku)) {
      row.errors.push("SKU duplicado dentro do arquivo.")
      row.normalized = null
    }
  }

  return {
    headers: normalizedHeaders,
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.errors.length === 0).length,
      invalidRows: rows.filter((row) => row.errors.length > 0).length,
    },
  }
}
