import type { CatalogItem, CatalogItemInput, CatalogItemStatus } from "@/lib/catalog-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { normalizeDataImageUrlForUpload } from "@/lib/server/image-normalization"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type CatalogData = {
  items: CatalogItem[]
}

const dataFile = getRuntimeDataFile("catalog-items.json")
const storeKey = "catalog-items"
let mutationQueue = Promise.resolve()

const defaultImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%23f3f4f6'/%3E%3Cpath d='M351 175h98v100h-98z' fill='none' stroke='%239ca3af' stroke-width='12'/%3E%3Ccircle cx='382' cy='205' r='13' fill='%239ca3af'/%3E%3Cpath d='M351 256l35-38 26 25 17-15 20 28' fill='none' stroke='%239ca3af' stroke-width='12' stroke-linejoin='round'/%3E%3Ctext x='400' y='325' text-anchor='middle' font-family='Arial,sans-serif' font-size='24' fill='%236b7280'%3EProduto sem imagem%3C/text%3E%3C/svg%3E"

async function withCatalogMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readCatalogData(): Promise<CatalogData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { items: [] },
    normalize: (parsed) => ({
      items: Array.isArray((parsed as Partial<CatalogData>)?.items)
        ? (parsed as CatalogData).items
        : [],
    }),
  })
}

async function writeCatalogData(data: CatalogData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { items: [] } }, data)
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeStatus(value: unknown): CatalogItemStatus {
  return value === "inactive" ? "inactive" : "active"
}

function normalizeTags(value: unknown) {
  if (typeof value !== "object" || !value) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, tagValue]) => [normalizeText(key), normalizeText(tagValue)])
      .filter(([key, tagValue]) => key && tagValue)
  )
}

function getTenantItems(data: CatalogData, tenantSlug: string) {
  return data.items.filter((item) => item.tenantSlug === tenantSlug)
}

function assertSkuAvailable(items: CatalogItem[], tenantSlug: string, sku: string | undefined, ignoredId?: string) {
  if (!sku) return

  const skuExists = items.some((item) =>
    item.tenantSlug === tenantSlug &&
    item.id !== ignoredId &&
    item.sku?.toLowerCase() === sku.toLowerCase()
  )

  if (skuExists) {
    throw new Error("Ja existe um produto com este SKU.")
  }
}

async function buildCatalogItem(tenantSlug: string, input: CatalogItemInput): Promise<CatalogItem> {
  const name = normalizeText(input.name)
  const description = normalizeText(input.description)
  const category = normalizeText(input.category)
  const sku = normalizeText(input.sku)
  const now = new Date().toISOString()

  if (!name) {
    throw new Error("Nome do produto e obrigatorio.")
  }

  if (!category) {
    throw new Error("Categoria e obrigatoria.")
  }

  return {
    id: crypto.randomUUID(),
    tenantSlug,
    name,
    description,
    category,
    sku: sku || undefined,
    status: normalizeStatus(input.status),
    tags: normalizeTags(input.tags),
    imageUrl: await normalizeDataImageUrlForUpload(normalizeText(input.imageUrl) || defaultImage),
    createdAt: now,
    updatedAt: now,
  }
}

export async function listCatalogItems(tenantSlug: string) {
  const data = await readCatalogData()
  const tenantItems = getTenantItems(data, tenantSlug)

  return [...tenantItems].sort((left, right) =>
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  )
}

export async function createCatalogItem(tenantSlug: string, input: CatalogItemInput) {
  return withCatalogMutation(async () => {
    const data = await readCatalogData()
    const tenantItems = getTenantItems(data, tenantSlug)
    const otherTenantItems = data.items.filter((item) => item.tenantSlug !== tenantSlug)
    const item = await buildCatalogItem(tenantSlug, input)

    assertSkuAvailable(tenantItems, tenantSlug, item.sku)

    await writeCatalogData({
      items: [...otherTenantItems, item, ...tenantItems],
    })

    return item
  })
}

export async function updateCatalogItem(tenantSlug: string, itemId: string, input: Partial<CatalogItemInput>) {
  return withCatalogMutation(async () => {
    const data = await readCatalogData()
    const tenantItems = getTenantItems(data, tenantSlug)
    const otherTenantItems = data.items.filter((item) => item.tenantSlug !== tenantSlug)
    const existing = tenantItems.find((item) => item.id === itemId)

    if (!existing) {
      return null
    }

    const sku = input.sku === undefined ? existing.sku : normalizeText(input.sku) || undefined
    assertSkuAvailable(tenantItems, tenantSlug, sku, itemId)

    const updatedItem: CatalogItem = {
      ...existing,
      name: input.name === undefined ? existing.name : normalizeText(input.name),
      description: input.description === undefined ? existing.description : normalizeText(input.description),
      category: input.category === undefined ? existing.category : normalizeText(input.category),
      sku,
      status: input.status === undefined ? existing.status : normalizeStatus(input.status),
      tags: input.tags === undefined ? existing.tags : normalizeTags(input.tags),
      imageUrl: input.imageUrl === undefined ? existing.imageUrl : await normalizeDataImageUrlForUpload(normalizeText(input.imageUrl) || defaultImage),
      updatedAt: new Date().toISOString(),
    }

    if (!updatedItem.name) {
      throw new Error("Nome do produto e obrigatorio.")
    }

    if (!updatedItem.category) {
      throw new Error("Categoria e obrigatoria.")
    }

    await writeCatalogData({
      items: [
        ...otherTenantItems,
        ...tenantItems.map((item) => item.id === itemId ? updatedItem : item),
      ],
    })

    return updatedItem
  })
}

export async function deleteCatalogItem(tenantSlug: string, itemId: string) {
  return withCatalogMutation(async () => {
    const data = await readCatalogData()
    const tenantItems = getTenantItems(data, tenantSlug)
    const otherTenantItems = data.items.filter((item) => item.tenantSlug !== tenantSlug)
    const exists = tenantItems.some((item) => item.id === itemId)

    if (!exists) {
      return false
    }

    await writeCatalogData({
      items: [
        ...otherTenantItems,
        ...tenantItems.filter((item) => item.id !== itemId),
      ],
    })

    return true
  })
}

export async function bulkUpdateCatalogItems(tenantSlug: string, ids: string[], updates: { status?: CatalogItemStatus; delete?: boolean }) {
  return withCatalogMutation(async () => {
    const uniqueIds = new Set(ids.filter(Boolean))
    const data = await readCatalogData()
    const tenantItems = getTenantItems(data, tenantSlug)
    const otherTenantItems = data.items.filter((item) => item.tenantSlug !== tenantSlug)
    const now = new Date().toISOString()
    const nextTenantItems = updates.delete
      ? tenantItems.filter((item) => !uniqueIds.has(item.id))
      : tenantItems.map((item) =>
          uniqueIds.has(item.id)
            ? { ...item, status: normalizeStatus(updates.status), updatedAt: now }
            : item
        )

    await writeCatalogData({
      items: [...otherTenantItems, ...nextTenantItems],
    })

    return nextTenantItems.filter((item) => uniqueIds.has(item.id))
  })
}

export async function importCatalogItems(tenantSlug: string, inputs: CatalogItemInput[]) {
  return withCatalogMutation(async () => {
    const data = await readCatalogData()
    const tenantItems = getTenantItems(data, tenantSlug)
    const otherTenantItems = data.items.filter((item) => item.tenantSlug !== tenantSlug)
    const importedItems: CatalogItem[] = []
    for (const input of inputs) importedItems.push(await buildCatalogItem(tenantSlug, input))

    for (const item of importedItems) {
      assertSkuAvailable([...tenantItems, ...importedItems], tenantSlug, item.sku, item.id)
    }

    await writeCatalogData({
      items: [...otherTenantItems, ...importedItems, ...tenantItems],
    })

    return importedItems
  })
}
