import { connect as tlsConnect } from "node:tls"
import { promises as dns } from "node:dns"

import type { SuperadminDomainInput, SuperadminDomainRecord, SuperadminDomainSslStatus, SuperadminDomainStatus } from "@/lib/domain-types"
import type { Tenant } from "@/lib/tenant-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"
import { findTenant, listTenants, updateTenant } from "@/lib/server/tenants-store"

type DomainsData = {
  domains: SuperadminDomainRecord[]
}

const dataFile = getRuntimeDataFile("superadmin-domains.json")
const storeKey = "superadmin-domains"
let mutationQueue = Promise.resolve()

async function withDomainsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)
  return run
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeDomain(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function normalizeBoolean(value: unknown) {
  return value === true
}

function normalizeStatus(value: unknown): SuperadminDomainStatus {
  if (value === "active" || value === "pending" || value === "default" || value === "error") {
    return value
  }

  return "pending"
}

function normalizeSslStatus(value: unknown): SuperadminDomainSslStatus {
  if (value === "valid" || value === "awaiting" || value === "managed" || value === "invalid" || value === "none") {
    return value
  }

  return "awaiting"
}

function normalizeDomainRecord(value: unknown): SuperadminDomainRecord | null {
  const record = value as Partial<SuperadminDomainRecord> | null

  if (!record || typeof record !== "object") {
    return null
  }

  const id = normalizeText(record.id)
  const tenantId = normalizeText(record.tenantId)
  const tenantName = normalizeText(record.tenantName)
  const tenantSlug = normalizeText(record.tenantSlug)
  const domain = normalizeDomain(record.domain)

  if (!id || !tenantId || !tenantName || !tenantSlug || !domain) {
    return null
  }

  return {
    id,
    tenantId,
    tenantName,
    tenantSlug,
    domain,
    status: normalizeStatus(record.status),
    sslStatus: normalizeSslStatus(record.sslStatus),
    sslExpiresAt: normalizeText(record.sslExpiresAt) || undefined,
    isPrimary: normalizeBoolean(record.isPrimary),
    isManaged: normalizeBoolean(record.isManaged),
    dnsRecords: Array.isArray(record.dnsRecords) ? record.dnsRecords.map(normalizeText).filter(Boolean) : [],
    lastCheckedAt: normalizeText(record.lastCheckedAt) || undefined,
    lastError: normalizeText(record.lastError) || undefined,
    createdAt: normalizeText(record.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(record.updatedAt) || new Date().toISOString(),
  }
}

async function readDomainsData() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { domains: [] } satisfies DomainsData,
    normalize: (parsed) => ({
      domains: Array.isArray((parsed as Partial<DomainsData>)?.domains)
        ? ((parsed as DomainsData).domains.map(normalizeDomainRecord).filter(Boolean) as SuperadminDomainRecord[])
        : [],
    }),
  })
}

async function writeDomainsData(data: DomainsData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { domains: [] } satisfies DomainsData }, data)
}

function sortDomains(domains: SuperadminDomainRecord[]) {
  return [...domains].sort((left, right) => left.domain.localeCompare(right.domain, "pt-BR"))
}

function getDefaultDomainRecord(tenant: Tenant): SuperadminDomainRecord {
  const domain = `${tenant.slug}.comofica.ai`
  const timestamp = tenant.updatedAt || tenant.createdAt || new Date().toISOString()

  return {
    id: `default:${tenant.id}`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    domain,
    status: "default",
    sslStatus: "managed",
    isPrimary: !tenant.domain || normalizeDomain(tenant.domain) === domain,
    isManaged: true,
    dnsRecords: [],
    createdAt: tenant.createdAt,
    updatedAt: timestamp,
  }
}

function mergeTenantDefaults(tenants: Awaited<ReturnType<typeof listTenants>>, storedDomains: SuperadminDomainRecord[]) {
  const syntheticDefaults = tenants
    .map((tenant) => getDefaultDomainRecord(tenant))
    .filter((record) => !storedDomains.some((stored) => stored.tenantId === record.tenantId && stored.domain === record.domain))

  return sortDomains([...storedDomains, ...syntheticDefaults])
}

export async function listDomains() {
  const [data, tenants] = await Promise.all([readDomainsData(), listTenants()])
  return mergeTenantDefaults(tenants, data.domains)
}

export async function createDomain(input: SuperadminDomainInput) {
  return withDomainsMutation(async () => {
    const tenant = input.tenantId ? await findTenant(input.tenantId) : null
    if (!tenant) {
      throw new Error("Tenant não encontrado.")
    }

    const domain = normalizeDomain(input.domain)
    if (!domain) {
      throw new Error("Domínio é obrigatório.")
    }

    const data = await readDomainsData()
    const exists = data.domains.some((record) => record.domain === domain)
    if (exists) {
      throw new Error("Este domínio já foi cadastrado.")
    }

    const now = new Date().toISOString()
    const nextRecord: SuperadminDomainRecord = {
      id: crypto.randomUUID(),
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      domain,
      status: "pending",
      sslStatus: "awaiting",
      isPrimary: input.isPrimary === true,
      isManaged: false,
      dnsRecords: [],
      createdAt: now,
      updatedAt: now,
    }

    const nextDomains = data.domains.map((record) =>
      record.tenantId === tenant.id && nextRecord.isPrimary ? { ...record, isPrimary: false, updatedAt: now } : record
    )
    nextDomains.unshift(nextRecord)

    await writeDomainsData({ domains: nextDomains })

    if (nextRecord.isPrimary) {
      await updateTenant(tenant.id, { domain })
    }

    return nextRecord
  })
}

export async function deleteDomain(id: string) {
  return withDomainsMutation(async () => {
    const data = await readDomainsData()
    const existing = data.domains.find((record) => record.id === id)
    if (!existing) {
      return false
    }

    await writeDomainsData({
      domains: data.domains.filter((record) => record.id !== id),
    })

    const tenant = await findTenant(existing.tenantId)
    if (tenant?.domain && normalizeDomain(tenant.domain) === existing.domain) {
      await updateTenant(existing.tenantId, { domain: "" })
    }

    return true
  })
}

function resolveDnsRecords(hostname: string) {
  return Promise.allSettled([
    dns.resolve4(hostname),
    dns.resolveCname(hostname),
  ]).then((results) => {
    const values = new Set<string>()

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const item of result.value) {
          values.add(item)
        }
      }
    }

    return Array.from(values)
  })
}

function readTlsCertificate(hostname: string) {
  return new Promise<{ validTo?: string } | null>((resolve) => {
    const socket = tlsConnect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false, timeout: 5000 },
      () => {
        const certificate = socket.getPeerCertificate()
        socket.end()
        if (!certificate || Object.keys(certificate).length === 0) {
          resolve(null)
          return
        }

        resolve({ validTo: typeof certificate.valid_to === "string" ? certificate.valid_to : undefined })
      }
    )

    socket.on("error", () => resolve(null))
    socket.on("timeout", () => {
      socket.destroy()
      resolve(null)
    })
  })
}

function getStatusFromCheck(records: string[], validTo?: string, errorMessage?: string) {
  const hasDns = records.length > 0
  const hasTls = Boolean(validTo)

  return {
    status: errorMessage ? "error" : hasDns ? "active" : "pending",
    sslStatus: hasTls ? "valid" : errorMessage ? "invalid" : hasDns ? "awaiting" : "none",
  } satisfies { status: SuperadminDomainStatus; sslStatus: SuperadminDomainSslStatus }
}

export async function checkDomain(id: string) {
  return withDomainsMutation(async () => {
    const data = await readDomainsData()
    const existing = data.domains.find((record) => record.id === id)
    if (!existing) {
      return null
    }

    const now = new Date().toISOString()
    let dnsRecords: string[] = []
    let validTo: string | undefined
    let lastError: string | undefined

    try {
      dnsRecords = await resolveDnsRecords(existing.domain)
      const certificate = await readTlsCertificate(existing.domain)
      validTo = certificate?.validTo ? new Date(certificate.validTo).toISOString() : undefined
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Falha ao validar domínio."
    }

    if (dnsRecords.length === 0 && !lastError) {
      lastError = "Nenhum registro DNS encontrado para o domínio."
    }

    const nextState = getStatusFromCheck(dnsRecords, validTo, lastError)
    const updated: SuperadminDomainRecord = {
      ...existing,
      ...nextState,
      dnsRecords,
      sslExpiresAt: validTo,
      lastCheckedAt: now,
      lastError,
      updatedAt: now,
    }

    await writeDomainsData({
      domains: data.domains.map((record) => record.id === id ? updated : record),
    })

    return updated
  })
}
