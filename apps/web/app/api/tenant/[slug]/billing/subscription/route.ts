import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getTenantBillingSubscription } from "@/lib/server/billing-store"
import { findTenant } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const session = await auth()

  if (!session?.user?.id || session.user.tenantSlug !== slug) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 })
  }

  const tenant = await findTenant(slug)
  if (!tenant) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 })

  const subscription = await getTenantBillingSubscription(tenant)

  return NextResponse.json({
    planCode: subscription?.planCode ?? tenant.planCode ?? null,
    status: subscription?.status ?? "none",
    provider: subscription?.provider ?? null,
    amountCents: subscription?.amountCents ?? null,
    currency: subscription?.currency ?? "BRL",
    activatedAt: subscription?.activatedAt ?? null,
    cancelledAt: subscription?.cancelledAt ?? null,
    receiptUrl: subscription?.receiptUrl ?? null,
    checkoutUrl: subscription?.status === "checkout_pending" ? subscription.checkoutUrl ?? null : null,
    customerName: subscription?.customerName ?? null,
    customerEmail: subscription?.customerEmail ?? null,
  })
}
