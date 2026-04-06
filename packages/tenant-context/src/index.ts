export type TenantContext = {
  tenantId: string
  slug: string
  hostname?: string | null
  planCode: string
  llmProvider?: "openrouter"
}

export function formatTenantStoragePrefix(context: TenantContext) {
  return `tenants/${context.slug}-${context.tenantId}`
}
