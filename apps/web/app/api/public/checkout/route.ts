import { NextResponse } from "next/server"

import type { TenantPlanCode } from "@/lib/tenant-types"
import { createStoredAuthUser, deleteStoredAuthUserById, validateStrongPassword } from "@/lib/server/auth-users-store"
import { createAbacatePayCustomer, createAbacatePaySubscriptionCheckout } from "@/lib/server/abacatepay-client"
import { getAbacatePaySettings, getConfiguredPlan, getConfiguredStripePlan, getPlanCatalog, getStripeSettings, upsertTenantBillingSubscription } from "@/lib/server/billing-store"
import { createTenant, deleteTenant } from "@/lib/server/tenants-store"
import { createStripeCustomer, createStripeSubscriptionCheckout } from "@/lib/server/stripe-client"

export const runtime = "nodejs"

type CheckoutRequest = {
  planCode?: unknown
  provider?: unknown
  companyName?: unknown
  contactName?: unknown
  email?: unknown
  phone?: unknown
  taxId?: unknown
  password?: unknown
  website?: unknown
}

function text(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export async function POST(request: Request) {
  let tenantId = ""
  let authUserId = ""
  let providerCheckoutCreated = false
  try {
    const payload = await request.json().catch(() => null) as CheckoutRequest | null
    if (!payload || text(payload.website, 200)) return NextResponse.json({ error: "Não foi possível iniciar o checkout." }, { status: 400 })
    const planCode = text(payload.planCode, 40).toLowerCase() as TenantPlanCode
    const provider = payload.provider === "stripe" || payload.provider === "abacatepay" ? payload.provider : null
    const companyName = text(payload.companyName, 120)
    const contactName = text(payload.contactName, 120)
    const email = text(payload.email, 254).toLowerCase()
    const phone = text(payload.phone, 40)
    const taxId = text(payload.taxId, 40).replace(/\D/g, "")
    const password = validateStrongPassword(payload.password)

    if (!/^[a-z][a-z0-9-]{1,39}$/.test(planCode) || !provider || !companyName || !contactName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Confira o plano, os dados da empresa e o e-mail." }, { status: 400 })
    }
    if (taxId && taxId.length !== 11 && taxId.length !== 14) {
      return NextResponse.json({ error: "Informe um CPF ou CNPJ válido." }, { status: 400 })
    }

    const [catalog, abacatePay, stripe] = await Promise.all([getPlanCatalog(), getAbacatePaySettings(), getStripeSettings()])
    const plan = catalog[planCode]
    if (!plan?.enabled || plan.priceCents <= 0) return NextResponse.json({ error: "Este plano não está disponível para contratação." }, { status: 404 })
    const checkoutPlan = provider === "stripe"
      ? getConfiguredStripePlan(stripe, catalog, planCode)
      : getConfiguredPlan(abacatePay, catalog, planCode)
    if (provider === "abacatepay" && !taxId) return NextResponse.json({ error: "Informe o CPF ou CNPJ para pagar pela AbacatePay." }, { status: 400 })

    const tenant = await createTenant({
      name: companyName,
      status: "draft",
      planCode,
      contactName,
      contactEmail: email,
      phone,
      businessVertical: "generic",
    })
    tenantId = tenant.id
    const authUser = await createStoredAuthUser({
      name: contactName,
      email,
      password,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      roles: ["tenant", "tenant_admin"],
      status: "disabled",
    })
    authUserId = authUser.id

    const configuredOrigin = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim()
    const origin = configuredOrigin ? new URL(configuredOrigin).origin : new URL(request.url).origin
    if (provider === "stripe") {
      const customer = await createStripeCustomer(stripe, { name: contactName, email, phone: phone || undefined, tenantId: tenant.id, tenantSlug: tenant.slug })
      const externalId = `comofica:${tenant.id}:${planCode}:stripe:${crypto.randomUUID()}`
      const checkout = await createStripeSubscriptionCheckout(stripe, {
        customerId: customer.id,
        priceId: getConfiguredStripePlan(stripe, catalog, planCode).priceId!,
        externalId,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        planCode,
        successUrl: stripe.successUrl || `${origin}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: stripe.cancelUrl || `${origin}/checkout?planCode=${encodeURIComponent(planCode)}`,
      })
      providerCheckoutCreated = true
      await upsertTenantBillingSubscription({
        tenantId: tenant.id, tenantSlug: tenant.slug, planCode, status: "checkout_pending", provider,
        customerId: customer.id, customerEmail: email, customerName: contactName, checkoutId: checkout.checkoutId,
        subscriptionId: checkout.subscriptionId, checkoutUrl: checkout.checkoutUrl, externalId,
        tokensIncluded: plan.tokensIncluded, amountCents: plan.priceCents, currency: stripe.currency.toUpperCase(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      })
      return NextResponse.json({ checkoutUrl: checkout.checkoutUrl })
    }

    const customer = await createAbacatePayCustomer(abacatePay, { name: contactName, email, taxId, cellphone: phone || undefined })
    const externalId = `comofica:${tenant.id}:${planCode}:${crypto.randomUUID()}`
    const checkout = await createAbacatePaySubscriptionCheckout(abacatePay, {
      customerId: customer.customerId,
      productId: checkoutPlan.productId!,
      externalId,
      returnUrl: abacatePay.returnUrl || `${origin}/checkout/sucesso`,
      completionUrl: abacatePay.completionUrl || `${origin}/checkout/sucesso`,
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug, planCode },
    })
    providerCheckoutCreated = true
    await upsertTenantBillingSubscription({
      tenantId: tenant.id, tenantSlug: tenant.slug, planCode, status: "checkout_pending", provider,
      customerId: customer.customerId, customerEmail: email, customerName: contactName, checkoutId: checkout.checkoutId,
      checkoutUrl: checkout.checkoutUrl, externalId, tokensIncluded: plan.tokensIncluded, amountCents: plan.priceCents, currency: "BRL", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl })
  } catch {
    if (!providerCheckoutCreated) {
      if (authUserId) await deleteStoredAuthUserById(authUserId).catch(() => false)
      if (tenantId) await deleteTenant(tenantId).catch(() => false)
    }
    return NextResponse.json({ error: "Não foi possível iniciar o checkout. Confira os dados ou tente novamente mais tarde." }, { status: 400 })
  }
}
