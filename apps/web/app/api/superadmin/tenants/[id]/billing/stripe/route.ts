import { NextResponse } from "next/server"

import type { TenantPlanCode } from "@/lib/tenant-types"
import {
  getConfiguredStripePlan,
  getPlanCatalog,
  getStripeSettings,
  getTenantBillingSubscription,
  toPublicStripeSettings,
  upsertTenantBillingSubscription,
} from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { attachReferralToTenant } from "@/lib/server/commercial-benefits-store"
import { createStripeProductAndPrice, createStripeCustomer, createStripeSubscriptionCheckout } from "@/lib/server/stripe-client"
import { findTenant } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

type CheckoutPayload = {
  name?: unknown
  email?: unknown
  cellphone?: unknown
  planCode?: unknown
  referralCode?: unknown
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePlanCode(value: unknown, fallback: TenantPlanCode): TenantPlanCode {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,39}$/.test(value) ? value : fallback
}

function getOrigin(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const { id } = await context.params
  const tenant = await findTenant(id)

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  const [settings, subscription] = await Promise.all([
    getStripeSettings(),
    getTenantBillingSubscription(tenant),
  ])

  return NextResponse.json({
    settings: toPublicStripeSettings(settings, getOrigin(request)),
    subscription: subscription?.provider === "stripe" ? subscription : null,
  })
}

export async function POST(request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    const tenant = await findTenant(id)

    if (!tenant) {
      return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
    }

    const payload = await request.json().catch(() => null) as CheckoutPayload | null
    const email = normalizeText(payload?.email || tenant.contactEmail).toLowerCase()
    const name = normalizeText(payload?.name || tenant.contactName || tenant.name)
    const planCode = normalizePlanCode(payload?.planCode, tenant.planCode)
    if (planCode !== tenant.planCode) throw new Error("Salve o plano do cliente antes de gerar o checkout.")
    const referralCode = normalizeText(payload?.referralCode)

    if (!email) {
      return NextResponse.json({ error: "Informe o email do cliente antes de gerar o checkout Stripe." }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Informe o nome do cliente antes de gerar o checkout Stripe." }, { status: 400 })
    }

    const [settings, planCatalog] = await Promise.all([getStripeSettings(), getPlanCatalog()])
    const plan = getConfiguredStripePlan(settings, planCatalog, planCode, tenant)

    if (planCode === "custom" && (plan.priceCents <= 0 || plan.tokensIncluded <= 0)) {
      return NextResponse.json({ error: "Configure um preço e uma cota positiva de créditos para o plano Personalizado antes de gerar o checkout." }, { status: 400 })
    }
    if (planCode === "custom" && tenant.customPlan) {
      const previous = await getTenantBillingSubscription(tenant)
      if (previous?.status === "active") throw new Error("Este cliente já possui uma assinatura ativa. Cancele-a no provedor antes de gerar uma nova contratação.")
      const reusable = previous?.provider === "stripe" && previous.amountCents === plan.priceCents && previous.tokensIncluded === plan.tokensIncluded
      if (reusable && previous.priceId) plan.priceId = previous.priceId
      else Object.assign(plan, await createStripeProductAndPrice(settings, plan))
    }
    const origin = getOrigin(request)
    const customer = await createStripeCustomer(settings, {
      name,
      email,
      phone: normalizeText(payload?.cellphone || tenant.phone) || undefined,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    })
    const externalId = `comofica:${tenant.id}:${planCode}:stripe:${crypto.randomUUID()}`
    const checkout = await createStripeSubscriptionCheckout(settings, {
      customerId: customer.id,
      priceId: plan.priceId!,
      externalId,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      planCode,
      referralCode,
      successUrl: settings.successUrl || `${origin}/superadmin/tenants/${tenant.id}?checkout=stripe-success`,
      cancelUrl: settings.cancelUrl || `${origin}/superadmin/tenants/${tenant.id}?checkout=stripe-cancel`,
    })
    if (referralCode) {
      await attachReferralToTenant({
        referralCode,
        referredTenantId: tenant.id,
        referredTenantSlug: tenant.slug,
      })
    }
    const subscription = await upsertTenantBillingSubscription({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      planCode,
      status: "checkout_pending",
      provider: "stripe",
      customerId: customer.id,
      customerEmail: email,
      customerName: name,
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
      subscriptionId: checkout.subscriptionId,
      externalId,
      tokensIncluded: plan.tokensIncluded,
      productId: plan.productId,
      priceId: plan.priceId,
      amountCents: plan.priceCents,
      currency: settings.currency.toUpperCase(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ subscription })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel gerar o checkout Stripe.",
    }, { status: 400 })
  }
}
