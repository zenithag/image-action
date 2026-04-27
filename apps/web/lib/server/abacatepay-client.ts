import type { AbacatePayPlanConfig, AbacatePaySettings } from "@/lib/billing-types"

type AbacatePayProductResponse = {
  data?: {
    id?: string
    name?: string
    externalId?: string
  }
  error?: string
  message?: string
}

type AbacatePayCustomerResponse = {
  data?: {
    id?: string
    email?: string
    name?: string
  }
  error?: string
  message?: string
}

type AbacatePaySubscriptionResponse = {
  data?: {
    id?: string
    url?: string
    checkoutUrl?: string
    externalId?: string
    customerId?: string
    productId?: string
  }
  error?: string
  message?: string
}

function getApiKey(settings: AbacatePaySettings) {
  const apiKey = settings.apiKey?.trim()

  if (!apiKey) {
    throw new Error("API key da AbacatePay nao configurada.")
  }

  return apiKey
}

function buildUrl(settings: AbacatePaySettings, path: string) {
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, "")
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`
}

async function requestAbacatePay<T>(settings: AbacatePaySettings, path: string, payload: unknown): Promise<T> {
  const response = await fetch(buildUrl(settings, path), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${getApiKey(settings)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => null) as (T & { error?: string; message?: string }) | null

  if (!response.ok || !data) {
    throw new Error(data?.error || data?.message || `AbacatePay retornou HTTP ${response.status}.`)
  }

  return data
}

export async function createAbacatePayProduct(settings: AbacatePaySettings, plan: AbacatePayPlanConfig) {
  const payload = {
    externalId: plan.productExternalId,
    name: plan.productName,
    description: plan.description,
    quantity: 1,
    price: plan.priceCents,
    type: "RECURRING",
    billingPeriod: plan.cycle,
    returnUrl: settings.returnUrl,
    completionUrl: settings.completionUrl,
  }
  const response = await requestAbacatePay<AbacatePayProductResponse>(settings, "/products/create", payload)
  const productId = response.data?.id

  if (!productId) {
    throw new Error("AbacatePay nao retornou o id do produto.")
  }

  return {
    productId,
    raw: response,
  }
}

export async function createAbacatePayCustomer(settings: AbacatePaySettings, input: {
  name: string
  email: string
  taxId?: string
  cellphone?: string
}) {
  const response = await requestAbacatePay<AbacatePayCustomerResponse>(settings, "/customers/create", {
    name: input.name,
    email: input.email,
    taxId: input.taxId,
    cellphone: input.cellphone,
  })
  const customerId = response.data?.id

  if (!customerId) {
    throw new Error("AbacatePay nao retornou o id do cliente.")
  }

  return {
    customerId,
    raw: response,
  }
}

export async function createAbacatePaySubscriptionCheckout(settings: AbacatePaySettings, input: {
  customerId: string
  productId: string
  externalId: string
  returnUrl?: string
  completionUrl?: string
  metadata?: Record<string, string>
}) {
  const response = await requestAbacatePay<AbacatePaySubscriptionResponse>(settings, "/subscriptions/create", {
    customerId: input.customerId,
    productId: input.productId,
    externalId: input.externalId,
    returnUrl: input.returnUrl || settings.returnUrl,
    completionUrl: input.completionUrl || settings.completionUrl,
    metadata: input.metadata,
  })
  const checkoutUrl = response.data?.url || response.data?.checkoutUrl

  if (!checkoutUrl) {
    throw new Error("AbacatePay nao retornou a URL do checkout de assinatura.")
  }

  return {
    checkoutId: response.data?.id,
    checkoutUrl,
    raw: response,
  }
}
