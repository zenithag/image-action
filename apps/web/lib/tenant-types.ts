export type TenantStatus = "draft" | "active" | "suspended" | "archived"
export type TenantPlanCode = string
export type BuiltInTenantPlanCode = "starter" | "pro" | "enterprise" | "custom"
export type TenantBusinessVertical = string
export type TenantCustomPlan = { priceCents: number; tokensIncluded: number }

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
  customPlan?: TenantCustomPlan
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
  customPlan?: TenantCustomPlan
  businessVertical?: TenantBusinessVertical
  domain?: string
  contactEmail?: string
  contactName?: string
  phone?: string
  website?: string
}
