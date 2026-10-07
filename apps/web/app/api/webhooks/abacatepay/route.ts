import crypto from "node:crypto"

import { NextResponse } from "next/server"

import type { TenantBillingStatus } from "@/lib/billing-types"
import type { TenantPlanCode } from "@/lib/tenant-types"
import {
  findBillingSubscriptionByAbacatePayReference,
  getAbacatePaySettings,
  markAbacatePayWebhookEventProcessed,
  recordAbacatePayWebhookEvent,
  upsertTenantBillingSubscription,
} from "@/lib/server/billing-store"
import { attachReferralToTenant, grantReferralConversionCredits } from "@/lib/server/commercial-benefits-store"
import { grantTenantManualTokens } from "@/lib/server/token-ledger-store"
import { findTenant, updateTenant } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

type AbacateWebhookPayload = {
  id?: string
  event?: string
  data?: {
    id?: string
    status?: string
    paidAmount?: number
    amount?: number
    url?: string
    receiptUrl?: string
    externalId?: string
    customer?: {
      id?: string
      email?: string
      name?: string
    }
    customerId?: string
    checkout?: {
      id?: string
      url?: string
      externalId?: string
    }
    subscription?: {
      id?: string
      status?: string
      externalId?: string
    }
    metadata?: {
      tenantId?: string
      tenantSlug?: string
      planCode?: string
      referralCode?: string
    }
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function verifyWebhookSignature(rawBody: string, signature: string, publicKey: string) {
  const expected = crypto
    .createHmac("sha256", publicKey)
    .update(rawBody)
    .digest("hex")

  return timingSafeEqual(signature, expected)
}

function extractReference(payload: AbacateWebhookPayload) {
  return {
    externalId: normalizeText(payload.data?.externalId || payload.data?.checkout?.externalId || payload.data?.subscription?.externalId),
    checkoutId: normalizeText(payload.data?.checkout?.id || (payload.event?.startsWith("billing.") ? payload.data?.id : "")),
    subscriptionId: normalizeText(payload.data?.subscription?.id || (payload.event?.startsWith("subscription.") ? payload.data?.id : "")),
  }
}

function mapSubscriptionStatus(event: string, status?: string): TenantBillingStatus {
  if (event === "subscription.cancelled" || event === "subscription.canceled") return "cancelled"
  if (event === "billing.failed") return "failed"
  if (status === "CANCELLED" || status === "CANCELED") return "cancelled"
  if (status === "FAILED") return "failed"
  if (event === "subscription.completed" || event === "subscription.renewed" || status === "ACTIVE") return "active"
  return "checkout_pending"
}

async function processSubscriptionEvent(payload: AbacateWebhookPayload, eventId: string) {
  const event = normalizeText(payload.event)
  const reference = extractReference(payload)
  const subscription = await findBillingSubscriptionByAbacatePayReference(reference)

  if (!subscription) {
    return false
  }

  const tenant = await findTenant(subscription.tenantId)
  const status = mapSubscriptionStatus(event, payload.data?.status || payload.data?.subscription?.status)
  const activatedAt = status === "active" ? new Date().toISOString() : subscription.activatedAt
  const cancelledAt = status === "cancelled" ? new Date().toISOString() : subscription.cancelledAt

  await upsertTenantBillingSubscription({
    ...subscription,
    status,
    customerId: normalizeText(payload.data?.customer?.id || payload.data?.customerId) || subscription.customerId,
    customerEmail: normalizeText(payload.data?.customer?.email).toLowerCase() || subscription.customerEmail,
    customerName: normalizeText(payload.data?.customer?.name) || subscription.customerName,
    checkoutId: reference.checkoutId || subscription.checkoutId,
    checkoutUrl: normalizeText(payload.data?.checkout?.url || payload.data?.url) || subscription.checkoutUrl,
    subscriptionId: reference.subscriptionId || subscription.subscriptionId,
    paidAmountCents: typeof payload.data?.paidAmount === "number" ? payload.data.paidAmount : subscription.paidAmountCents,
    amountCents: typeof payload.data?.amount === "number" ? payload.data.amount : subscription.amountCents,
    receiptUrl: normalizeText(payload.data?.receiptUrl) || subscription.receiptUrl,
    lastWebhookEvent: event,
    lastWebhookId: eventId,
    lastWebhookAt: new Date().toISOString(),
    activatedAt,
    cancelledAt,
  })

  if (tenant && status === "active" && event !== "billing.failed") {
    const tokensIncluded = await getTokensForSubscription(subscription.planCode)
    const referralCode = normalizeText(payload.data?.metadata?.referralCode)

    await updateTenant(tenant.id, {
      status: "active",
      planCode: subscription.planCode,
    })

    if (referralCode) {
      await attachReferralToTenant({
        referralCode,
        referredTenantId: tenant.id,
        referredTenantSlug: tenant.slug,
      })
    }

    await grantTenantManualTokens({
      tenantSlug: tenant.slug,
      amount: tokensIncluded,
      description: `Crédito da assinatura AbacatePay ${subscription.planCode}.`,
      createdBy: "abacatepay",
      referenceId: eventId,
    })

    await grantReferralConversionCredits({
      referredTenantSlug: tenant.slug,
      subscriptionReferenceId: subscription.subscriptionId || subscription.checkoutId || eventId,
    })
  }

  if (tenant && status === "cancelled") {
    await updateTenant(tenant.id, {
      status: "suspended",
      planCode: subscription.planCode,
    })
  }

  return true
}

async function getTokensForSubscription(planCode: TenantPlanCode) {
  const settings = await getAbacatePaySettings()
  return settings.plans[planCode]?.tokensIncluded || 1
}

export async function POST(request: Request) {
  const settings = await getAbacatePaySettings()
  const url = new URL(request.url)
  const rawBody = await request.text()
  const querySecret = url.searchParams.get("webhookSecret") || ""

  if (settings.webhookSecret && !timingSafeEqual(querySecret, settings.webhookSecret)) {
    return NextResponse.json({ error: "Webhook secret invalido." }, { status: 401 })
  }

  const signature = request.headers.get("x-webhook-signature") || request.headers.get("x-abacatepay-signature") || ""
  if (settings.webhookPublicKey) {
    if (!signature || !verifyWebhookSignature(rawBody, signature, settings.webhookPublicKey)) {
      return NextResponse.json({ error: "Assinatura do webhook invalida." }, { status: 401 })
    }
  }

  let payload: AbacateWebhookPayload

  try {
    payload = JSON.parse(rawBody) as AbacateWebhookPayload
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 })
  }

  const event = normalizeText(payload.event)
  const reference = extractReference(payload)
  const eventId = normalizeText(payload.id) || `${event}:${reference.externalId || reference.checkoutId || reference.subscriptionId || crypto.randomUUID()}`

  if (!event) {
    return NextResponse.json({ error: "Evento nao informado." }, { status: 400 })
  }

  const recorded = await recordAbacatePayWebhookEvent({
    id: eventId,
    event,
    externalId: reference.externalId || undefined,
    checkoutId: reference.checkoutId || undefined,
    subscriptionId: reference.subscriptionId || undefined,
    processed: false,
  })

  if (!recorded.created) {
    return NextResponse.json({ ok: true, duplicated: true })
  }

  const shouldProcessSubscription = event.startsWith("subscription.") || event.startsWith("billing.")
  const processed = shouldProcessSubscription ? await processSubscriptionEvent(payload, eventId) : false

  if (processed) {
    await markAbacatePayWebhookEventProcessed(eventId)
  }

  return NextResponse.json({ ok: true, processed })
}
