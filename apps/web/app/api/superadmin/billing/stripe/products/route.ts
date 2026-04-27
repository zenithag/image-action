import { NextResponse } from "next/server"

import type { TenantPlanCode } from "@/lib/tenant-types"
import { getStripeSettings, toPublicStripeSettings, updateStripeSettings } from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { createStripeProductAndPrice } from "@/lib/server/stripe-client"

export const runtime = "nodejs"

type ProductPayload = {
  planCode?: unknown
}

function normalizePlanCode(value: unknown): TenantPlanCode | null {
  return value === "starter" || value === "pro" || value === "enterprise" ? value : null
}

function getOrigin(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json().catch(() => null) as ProductPayload | null
    const planCode = normalizePlanCode(payload?.planCode)

    if (!planCode) {
      return NextResponse.json({ error: "Plano invalido." }, { status: 400 })
    }

    const settings = await getStripeSettings()
    const plan = settings.plans[planCode]

    if (!settings.enabled) {
      return NextResponse.json({ error: "Habilite o Stripe antes de criar produtos." }, { status: 400 })
    }

    const created = await createStripeProductAndPrice(settings, plan)
    const updated = await updateStripeSettings({
      plans: {
        ...settings.plans,
        [planCode]: {
          ...plan,
          productId: created.productId,
          priceId: created.priceId,
        },
      },
    })

    return NextResponse.json({
      productId: created.productId,
      priceId: created.priceId,
      settings: toPublicStripeSettings(updated, getOrigin(request)),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar produto/preco no Stripe.",
    }, { status: 400 })
  }
}
