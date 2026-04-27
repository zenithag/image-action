import type { Tenant, TenantBusinessVertical, TenantInput, TenantPlanCode, TenantStatus } from "@/lib/tenant-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type TenantsData = {
  tenants: Tenant[]
}

const dataFile = getRuntimeDataFile("tenants.json")
const storeKey = "tenants"
const tenantStatuses = new Set<TenantStatus>(["draft", "active", "suspended", "archived"])
const tenantPlans = new Set<TenantPlanCode>(["starter", "pro", "enterprise"])
const tenantVerticals = new Set<TenantBusinessVertical>(["generic", "decor", "fashion", "automotive", "furniture"])

let mutationQueue = Promise.resolve()

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export function slugifyTenant(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function normalizeTenant(value: unknown): Tenant | null {
  const tenant = value as Partial<Tenant> | null

  if (!tenant || typeof tenant !== "object") {
    return null
  }

  const id = normalizeText(tenant.id)
  const name = normalizeText(tenant.name)
  const slug = slugifyTenant(normalizeText(tenant.slug))
  const status = tenantStatuses.has(tenant.status as TenantStatus) ? tenant.status as TenantStatus : "draft"
  const planCode = tenantPlans.has(tenant.planCode as TenantPlanCode) ? tenant.planCode as TenantPlanCode : "starter"
  const businessVertical = tenantVerticals.has(tenant.businessVertical as TenantBusinessVertical)
    ? tenant.businessVertical as TenantBusinessVertical
    : "generic"

  if (!id || !name || !slug) {
    return null
  }

  const stats = tenant.stats

  return {
    id,
    name,
    slug,
    status,
    planCode,
    businessVertical,
    domain: normalizeText(tenant.domain) || undefined,
    contactEmail: normalizeText(tenant.contactEmail).toLowerCase() || undefined,
    contactName: normalizeText(tenant.contactName) || undefined,
    phone: normalizeText(tenant.phone) || undefined,
    website: normalizeText(tenant.website) || undefined,
    stats: {
      conversations: normalizeNumber(stats?.conversations),
      compositions: normalizeNumber(stats?.compositions),
      contacts: normalizeNumber(stats?.contacts),
    },
    createdAt: normalizeText(tenant.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(tenant.updatedAt) || new Date().toISOString(),
  }
}

function normalizeTenantsData(parsed: unknown): TenantsData {
  const source = parsed as Partial<TenantsData> | Tenant[] | null
  const tenants = Array.isArray(source)
    ? source
    : Array.isArray(source?.tenants)
      ? source.tenants
      : []

  return {
    tenants: tenants
      .map(normalizeTenant)
      .filter((tenant): tenant is Tenant => Boolean(tenant)),
  }
}

async function withTenantsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readTenantsData() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { tenants: [] } satisfies TenantsData,
    normalize: normalizeTenantsData,
  })
}

async function writeTenantsData(data: TenantsData) {
  await writeJsonStore(
    { key: storeKey, filePath: dataFile, fallback: { tenants: [] } satisfies TenantsData },
    data
  )
}

function sortTenants(tenants: Tenant[]) {
  return [...tenants].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

export async function listTenants() {
  const data = await readTenantsData()
  return sortTenants(data.tenants)
}

export async function findTenant(idOrSlug: string) {
  const key = normalizeText(idOrSlug)
  if (!key) return null

  const data = await readTenantsData()
  return data.tenants.find((tenant) => tenant.id === key || tenant.slug === key) ?? null
}

function assertTenantInput(input: TenantInput) {
  const name = normalizeText(input.name)
  const slug = slugifyTenant(normalizeText(input.slug) || name)
  const status = tenantStatuses.has(input.status as TenantStatus) ? input.status as TenantStatus : "draft"
  const planCode = tenantPlans.has(input.planCode as TenantPlanCode) ? input.planCode as TenantPlanCode : "starter"
  const businessVertical = tenantVerticals.has(input.businessVertical as TenantBusinessVertical)
    ? input.businessVertical as TenantBusinessVertical
    : "generic"

  if (!name) {
    throw new Error("Nome do tenant e obrigatorio.")
  }

  if (!slug) {
    throw new Error("Slug do tenant e obrigatorio.")
  }

  return {
    name,
    slug,
    status,
    planCode,
    businessVertical,
    domain: normalizeText(input.domain) || undefined,
    contactEmail: normalizeText(input.contactEmail).toLowerCase() || undefined,
    contactName: normalizeText(input.contactName) || undefined,
    phone: normalizeText(input.phone) || undefined,
    website: normalizeText(input.website) || undefined,
  }
}

function assertSlugAvailable(tenants: Tenant[], slug: string, ignoredId?: string) {
  const taken = tenants.some((tenant) => tenant.slug === slug && tenant.id !== ignoredId)

  if (taken) {
    throw new Error("Este slug ja esta em uso.")
  }
}

export async function createTenant(input: TenantInput) {
  return withTenantsMutation(async () => {
    const data = await readTenantsData()
    const normalized = assertTenantInput(input)

    assertSlugAvailable(data.tenants, normalized.slug)

    const timestamp = new Date().toISOString()
    const tenant: Tenant = {
      id: crypto.randomUUID(),
      ...normalized,
      stats: {
        conversations: 0,
        compositions: 0,
        contacts: 0,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await writeTenantsData({ tenants: [tenant, ...data.tenants] })

    return tenant
  })
}

export async function updateTenant(id: string, input: Partial<TenantInput>) {
  return withTenantsMutation(async () => {
    const data = await readTenantsData()
    const existing = data.tenants.find((tenant) => tenant.id === id)

    if (!existing) {
      return null
    }

    const merged = assertTenantInput({
      name: input.name ?? existing.name,
      slug: input.slug ?? existing.slug,
      status: input.status ?? existing.status,
      planCode: input.planCode ?? existing.planCode,
      businessVertical: input.businessVertical ?? existing.businessVertical,
      domain: input.domain ?? existing.domain,
      contactEmail: input.contactEmail ?? existing.contactEmail,
      contactName: input.contactName ?? existing.contactName,
      phone: input.phone ?? existing.phone,
      website: input.website ?? existing.website,
    })

    assertSlugAvailable(data.tenants, merged.slug, existing.id)

    const updated: Tenant = {
      ...existing,
      ...merged,
      updatedAt: new Date().toISOString(),
    }

    await writeTenantsData({
      tenants: data.tenants.map((tenant) => tenant.id === id ? updated : tenant),
    })

    return updated
  })
}

export async function deleteTenant(id: string) {
  return withTenantsMutation(async () => {
    const data = await readTenantsData()
    const existing = data.tenants.find((tenant) => tenant.id === id)

    if (!existing) {
      return false
    }

    await writeTenantsData({
      tenants: data.tenants.filter((tenant) => tenant.id !== id),
    })

    return true
  })
}
