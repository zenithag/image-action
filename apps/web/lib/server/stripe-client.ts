import type { StripePlanConfig, StripeSettings } from "@/lib/billing-types"

type StripeCustomer = {
  id: string
  email?: string
  name?: string
}

type StripeProduct = {
  id: string
  name: string
}

type StripePrice = {
  id: string
  product: string
}

type StripeCheckoutSession = {
  id: string
  url: string | null
  customer?: string
  subscription?: string
  client_reference_id?: string
}

function getSecretKey(settings: StripeSettings) {
  const secretKey = settings.secretKey?.trim()

  if (!secretKey) {
    throw new Error("Secret key do Stripe nao configurada.")
  }

  return secretKey
}

function buildHeaders(settings: StripeSettings) {
  return {
    "Authorization": `Bearer ${getSecretKey(settings)}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": settings.apiVersion,
  }
}

function encodeForm(payload: Record<string, string | number | boolean | undefined>) {
  const body = new URLSearchParams()

  for (const [key, value] of Object.entries(payload)) {
    if (value == null || value === "") continue
    body.set(key, String(value))
  }

  return body.toString()
}

async function requestStripe<T>(settings: StripeSettings, path: string, payload: Record<string, string | number | boolean | undefined>) {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: buildHeaders(settings),
    body: encodeForm(payload),
  })
  const data = await response.json().catch(() => null) as (T & { error?: { message?: string } }) | null

  if (!response.ok || !data) {
    throw new Error(data?.error?.message || `Stripe retornou HTTP ${response.status}.`)
  }

  return data as T
}

export async function createStripeProductAndPrice(settings: StripeSettings, plan: StripePlanConfig) {
  const product = await requestStripe<StripeProduct>(settings, "/products", {
    name: plan.productName,
    description: plan.description,
    "metadata[planCode]": plan.planCode,
    "metadata[tokensIncluded]": plan.tokensIncluded,
    "metadata[source]": "comofica",
  })
  const price = await requestStripe<StripePrice>(settings, "/prices", {
    product: product.id,
    currency: settings.currency || "brl",
    unit_amount: plan.priceCents,
    "recurring[interval]": plan.interval,
    "metadata[planCode]": plan.planCode,
    "metadata[tokensIncluded]": plan.tokensIncluded,
    "metadata[source]": "comofica",
  })

  return {
    productId: product.id,
    priceId: price.id,
  }
}

export async function createStripeCustomer(settings: StripeSettings, input: {
  name: string
  email: string
  phone?: string
  tenantId: string
  tenantSlug: string
}) {
  return requestStripe<StripeCustomer>(settings, "/customers", {
    name: input.name,
    email: input.email,
    phone: input.phone,
    "metadata[tenantId]": input.tenantId,
    "metadata[tenantSlug]": input.tenantSlug,
    "metadata[source]": "comofica",
  })
}

export async function createStripeSubscriptionCheckout(settings: StripeSettings, input: {
  customerId: string
  priceId: string
  externalId: string
  tenantId: string
  tenantSlug: string
  planCode: string
  referralCode?: string
  successUrl: string
  cancelUrl: string
}) {
  const session = await requestStripe<StripeCheckoutSession>(settings, "/checkout/sessions", {
    mode: "subscription",
    customer: input.customerId,
    client_reference_id: input.externalId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": 1,
    "metadata[tenantId]": input.tenantId,
    "metadata[tenantSlug]": input.tenantSlug,
    "metadata[planCode]": input.planCode,
    "metadata[externalId]": input.externalId,
    "metadata[referralCode]": input.referralCode,
    "subscription_data[metadata][tenantId]": input.tenantId,
    "subscription_data[metadata][tenantSlug]": input.tenantSlug,
    "subscription_data[metadata][planCode]": input.planCode,
    "subscription_data[metadata][externalId]": input.externalId,
    "subscription_data[metadata][referralCode]": input.referralCode,
  })

  if (!session.url) {
    throw new Error("Stripe nao retornou a URL do Checkout.")
  }

  return {
    checkoutId: session.id,
    checkoutUrl: session.url,
    subscriptionId: typeof session.subscription === "string" ? session.subscription : undefined,
  }
}
