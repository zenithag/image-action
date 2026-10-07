import type { TenantPlanCode } from "@/lib/tenant-types"

export type AbacatePayCycle = "WEEKLY" | "MONTHLY" | "SEMIANNUALLY" | "ANNUALLY"
export type StripeInterval = "day" | "week" | "month" | "year"
export type BillingProvider = "abacatepay" | "stripe"

export type PlanBillingCycle = AbacatePayCycle

export type PlanCatalogEntry = {
  planCode: TenantPlanCode
  enabled: boolean
  productName: string
  description: string
  priceCents: number
  tokensIncluded: number
  cycle: AbacatePayCycle
}

export type AbacatePayPlanConfig = {
  planCode: TenantPlanCode
  enabled: boolean
  productId?: string
  productExternalId: string
}

export type AbacatePaySettings = {
  enabled: boolean
  apiKey?: string
  baseUrl: string
  webhookSecret?: string
  webhookPublicKey?: string
  devMode: boolean
  returnUrl?: string
  completionUrl?: string
  plans: Partial<Record<TenantPlanCode, AbacatePayPlanConfig>>
  createdAt: string
  updatedAt: string
}

export type PublicAbacatePaySettings = Omit<AbacatePaySettings, "apiKey"> & {
  apiKeyConfigured: boolean
  apiKeyPreview?: string
  webhookUrl?: string
}

export type StripePlanConfig = {
  planCode: TenantPlanCode
  enabled: boolean
  productId?: string
  priceId?: string
}

export type StripeSettings = {
  enabled: boolean
  secretKey?: string
  webhookSecret?: string
  successUrl?: string
  cancelUrl?: string
  apiVersion: string
  currency: string
  plans: Partial<Record<TenantPlanCode, StripePlanConfig>>
  createdAt: string
  updatedAt: string
}

export type PublicStripeSettings = Omit<StripeSettings, "secretKey" | "webhookSecret"> & {
  secretKeyConfigured: boolean
  secretKeyPreview?: string
  webhookSecretConfigured: boolean
  webhookSecretPreview?: string
  webhookUrl?: string
}

export type TenantBillingStatus =
  | "none"
  | "checkout_pending"
  | "active"
  | "cancelled"
  | "past_due"
  | "failed"

export type TenantBillingSubscription = {
  tokensIncluded?: number
  productId?: string
  priceId?: string
  tenantId: string
  tenantSlug: string
  planCode: TenantPlanCode
  status: TenantBillingStatus
  provider: BillingProvider
  customerId?: string
  customerEmail?: string
  customerName?: string
  checkoutId?: string
  checkoutUrl?: string
  subscriptionId?: string
  externalId?: string
  amountCents?: number
  paidAmountCents?: number
  currency?: string
  receiptUrl?: string
  lastWebhookEvent?: string
  lastWebhookId?: string
  lastWebhookAt?: string
  activatedAt?: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
}

export type AbacatePayWebhookEventRecord = {
  id: string
  event: string
  provider: BillingProvider
  externalId?: string
  checkoutId?: string
  subscriptionId?: string
  processed: boolean
  receivedAt: string
}
