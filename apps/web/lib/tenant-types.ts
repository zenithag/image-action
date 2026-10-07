export type TenantStatus = "draft" | "active" | "suspended" | "archived"
export type TenantPlanCode = "starter" | "pro" | "enterprise" | "custom"
export type TenantBusinessVertical = "generic" | "decor" | "fashion" | "automotive" | "furniture"

export type TenantStats = {
  conversations: number
  compositions: number
  contacts: number
}

export type Tenant = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  planCode: TenantPlanCode
  businessVertical: TenantBusinessVertical
  domain?: string
  contactEmail?: string
  contactName?: string
  phone?: string
  website?: string
  stats: TenantStats
  createdAt: string
  updatedAt: string
}

export type TenantInput = {
  name: string
  slug?: string
  status?: TenantStatus
  planCode?: TenantPlanCode
  businessVertical?: TenantBusinessVertical
  domain?: string
  contactEmail?: string
  contactName?: string
  phone?: string
  website?: string
}
