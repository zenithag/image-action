export type SuperadminDomainStatus = "active" | "pending" | "default" | "error"

export type SuperadminDomainSslStatus = "valid" | "awaiting" | "managed" | "invalid" | "none"

export type SuperadminDomainRecord = {
  id: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  domain: string
  status: SuperadminDomainStatus
  sslStatus: SuperadminDomainSslStatus
  sslExpiresAt?: string
  isPrimary: boolean
  isManaged: boolean
  dnsRecords: string[]
  lastCheckedAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type SuperadminDomainInput = {
  tenantId?: string
  domain?: string
  isPrimary?: boolean
}
