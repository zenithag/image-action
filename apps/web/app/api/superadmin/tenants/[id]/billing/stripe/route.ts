import { NextResponse } from "next/server"

import type { TenantPlanCode } from "@/lib/tenant-types"
import {
  getConfiguredStripePlan,
  getStripeSettings,
  getTenantBillingSubscription,
  toPublicStripeSettings,
  upsertTenantBillingSubscription,
} from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { attachReferralToTenant } from "@/lib/server/commercial-benefits-store"
import { createStripeCustomer, createStripeSubscriptionCheckout } from "@/lib/server/stripe-client"
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
  return value === "starter" || value === "pro" || value === "enterprise" ? value : fallback
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
    const referralCode = normalizeText(payload?.referralCode)

    if (!email) {
      return NextResponse.json({ error: "Informe o email do cliente antes de gerar o checkout Stripe." }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Informe o nome do cliente antes de gerar o checkout Stripe." }, { status: 400 })
    }

    const settings = await getStripeSettings()
    const plan = getConfiguredStripePlan(settings, planCode)
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
