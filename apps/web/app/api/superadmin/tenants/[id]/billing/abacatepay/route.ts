import { NextResponse } from "next/server"

import type { TenantPlanCode } from "@/lib/tenant-types"
import { createAbacatePayCustomer, createAbacatePaySubscriptionCheckout } from "@/lib/server/abacatepay-client"
import {
  getAbacatePaySettings,
  getConfiguredPlan,
  getTenantBillingSubscription,
  toPublicAbacatePaySettings,
  upsertTenantBillingSubscription,
} from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { attachReferralToTenant } from "@/lib/server/commercial-benefits-store"
import { findTenant } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

type CheckoutPayload = {
  name?: unknown
  email?: unknown
  taxId?: unknown
  cellphone?: unknown
  planCode?: unknown
  referralCode?: unknown
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePlanCode(value: unknown, fallback: TenantPlanCode): TenantPlanCode {
  return value === "starter" || value === "pro" || value === "enterprise" || value === "custom" ? value : fallback
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
    getAbacatePaySettings(),
    getTenantBillingSubscription(tenant),
  ])

  return NextResponse.json({
    settings: toPublicAbacatePaySettings(settings, getOrigin(request)),
    subscription: subscription?.provider === "abacatepay" ? subscription : null,
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
      return NextResponse.json({ error: "Informe o email do cliente antes de gerar o checkout." }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Informe o nome do cliente antes de gerar o checkout." }, { status: 400 })
    }

    const settings = await getAbacatePaySettings()
    const plan = getConfiguredPlan(settings, planCode)

    if (planCode === "custom" && (plan.priceCents <= 0 || plan.tokensIncluded <= 0)) {
      return NextResponse.json({ error: "Configure um preço e uma cota positiva de créditos para o plano Personalizado antes de gerar o checkout." }, { status: 400 })
    }
    const customer = await createAbacatePayCustomer(settings, {
      name,
      email,
      taxId: normalizeText(payload?.taxId) || undefined,
      cellphone: normalizeText(payload?.cellphone || tenant.phone) || undefined,
    })
    const externalId = `comofica:${tenant.id}:${planCode}:${crypto.randomUUID()}`
    const checkout = await createAbacatePaySubscriptionCheckout(settings, {
      customerId: customer.customerId,
      productId: plan.productId!,
      externalId,
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        planCode,
        referralCode,
      },
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
      provider: "abacatepay",
      customerId: customer.customerId,
      customerEmail: email,
      customerName: name,
      checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl,
      externalId,
      amountCents: plan.priceCents,
      currency: "BRL",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({ subscription })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel gerar o checkout de assinatura.",
    }, { status: 400 })
  }
}
