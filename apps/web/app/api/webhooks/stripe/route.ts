import crypto from "node:crypto"

import { NextResponse } from "next/server"

import type { TenantBillingStatus } from "@/lib/billing-types"
import type { TenantPlanCode } from "@/lib/tenant-types"
import {
  findBillingSubscriptionByStripeReference,
  getStripeSettings,
  markAbacatePayWebhookEventProcessed,
  recordAbacatePayWebhookEvent,
  upsertTenantBillingSubscription,
} from "@/lib/server/billing-store"
import { grantTenantManualTokens } from "@/lib/server/token-ledger-store"
import { findTenant, updateTenant } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

type StripeEvent = {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePlanCode(value: unknown): TenantPlanCode {
  return value === "pro" || value === "enterprise" ? value : "starter"
}

function getMetadata(object: Record<string, unknown>) {
  const metadata = object.metadata
  return metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {}
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function parseStripeSignature(header: string) {
  return header.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=")
    if (!key || !value) return acc
    acc[key] = [...(acc[key] ?? []), value]
    return acc
  }, {})
}

function verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string) {
  const signature = parseStripeSignature(signatureHeader)
  const timestamp = signature.t?.[0]
  const signatures = signature.v1 ?? []

  if (!timestamp || signatures.length === 0) {
    return false
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")

  return signatures.some((candidate) => timingSafeEqual(candidate, expected))
}

function mapStripeStatus(eventType: string, stripeStatus?: string): TenantBillingStatus {
  if (eventType === "customer.subscription.deleted") return "cancelled"
  if (eventType === "invoice.payment_failed") return "past_due"
  if (stripeStatus === "active" || eventType === "checkout.session.completed" || eventType === "invoice.payment_succeeded") return "active"
  if (stripeStatus === "canceled") return "cancelled"
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due"
  return "checkout_pending"
}

async function processStripeEvent(event: StripeEvent) {
  const object = event.data.object
  const metadata = getMetadata(object)
  const checkoutId = event.type.startsWith("checkout.") ? normalizeText(object.id) : ""
  const subscriptionId = normalizeText(object.subscription || object.id)
  const customerId = normalizeText(object.customer)
  const subscription = await findBillingSubscriptionByStripeReference({
    checkoutId,
    subscriptionId,
    customerId,
  })

  if (!subscription) {
    return false
  }

  const tenant = await findTenant(subscription.tenantId)
  const planCode = normalizePlanCode(metadata.planCode || subscription.planCode)
  const settings = await getStripeSettings()
  const tokensIncluded = settings.plans[planCode]?.tokensIncluded || 1
  const status = mapStripeStatus(event.type, normalizeText(object.status))
  const activatedAt = status === "active" ? new Date().toISOString() : subscription.activatedAt
  const cancelledAt = status === "cancelled" ? new Date().toISOString() : subscription.cancelledAt

  await upsertTenantBillingSubscription({
    ...subscription,
    planCode,
    status,
    customerId: customerId || subscription.customerId,
    checkoutId: checkoutId || subscription.checkoutId,
    subscriptionId: subscriptionId || subscription.subscriptionId,
    paidAmountCents: typeof object.amount_paid === "number" ? object.amount_paid : subscription.paidAmountCents,
    amountCents: typeof object.amount_due === "number" ? object.amount_due : subscription.amountCents,
    receiptUrl: normalizeText(object.hosted_invoice_url || object.receipt_url) || subscription.receiptUrl,
    lastWebhookEvent: event.type,
    lastWebhookId: event.id,
    lastWebhookAt: new Date().toISOString(),
    activatedAt,
    cancelledAt,
  })

  if (tenant && status === "active") {
    await updateTenant(tenant.id, {
      status: "active",
      planCode,
    })
  }

  if (tenant && event.type === "invoice.payment_succeeded") {
    await grantTenantManualTokens({
      tenantSlug: tenant.slug,
      amount: tokensIncluded,
      description: `Crédito da assinatura Stripe ${planCode}.`,
      createdBy: "stripe",
      referenceId: event.id,
    })
  }

  if (tenant && status === "cancelled") {
    await updateTenant(tenant.id, {
      status: "suspended",
      planCode,
    })
  }

  return true
}

export async function POST(request: Request) {
  const settings = await getStripeSettings()
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature") || ""

  if (settings.webhookSecret && (!signature || !verifyStripeSignature(rawBody, signature, settings.webhookSecret))) {
    return NextResponse.json({ error: "Assinatura do webhook Stripe invalida." }, { status: 401 })
  }

  let event: StripeEvent

  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 })
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ error: "Evento Stripe invalido." }, { status: 400 })
  }

  const object = event.data?.object ?? {}
  const recorded = await recordAbacatePayWebhookEvent({
    id: event.id,
    event: event.type,
    provider: "stripe",
    checkoutId: event.type.startsWith("checkout.") ? normalizeText(object.id) || undefined : undefined,
    subscriptionId: normalizeText(object.subscription || object.id) || undefined,
    processed: false,
  })

  if (!recorded.created) {
    return NextResponse.json({ ok: true, duplicated: true })
  }

  const processed = await processStripeEvent(event)

  if (processed) {
    await markAbacatePayWebhookEventProcessed(event.id)
  }

  return NextResponse.json({ ok: true, processed })
}
