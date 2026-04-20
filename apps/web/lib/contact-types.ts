export type TenantContactSource = "manual" | "inbox"
export type TenantContactStatus = "active" | "archived"

export type TenantContact = {
  id: string
  tenantSlug: string
  name: string
  phone?: string
  email?: string
  company?: string
  source: TenantContactSource
  status: TenantContactStatus
  tags: string[]
  notes?: string
  externalContactId?: string
  conversationsCount: number
  lastContactAt?: string
  createdAt: string
  updatedAt: string
}

export type TenantContactInput = {
  name?: string
  phone?: string
  email?: string
  company?: string
  status?: TenantContactStatus
  tags?: string[] | string
  notes?: string
  externalContactId?: string
}
