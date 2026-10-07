import { NextResponse } from "next/server"

import type { TenantPlanCode } from "@/lib/tenant-types"
import { createAbacatePayProduct } from "@/lib/server/abacatepay-client"
import {
  getAbacatePaySettings,
  getPlanCatalog,
  toPublicAbacatePaySettings,
  updateAbacatePaySettings,
} from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type ProductPayload = {
  planCode?: unknown
}

function normalizePlanCode(value: unknown): TenantPlanCode | null {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,39}$/.test(value) ? value : null
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

    const settings = await getAbacatePaySettings()
    const planCatalog = await getPlanCatalog()
    const link = settings.plans[planCode]
    if (!planCatalog[planCode] || !link) return NextResponse.json({ error: "Plano não encontrado ou ainda não conectado à AbacatePay." }, { status: 404 })
    const plan = { ...planCatalog[planCode], ...link }

    if (planCode === "custom" && (plan.priceCents <= 0 || plan.tokensIncluded <= 0)) {
      return NextResponse.json({ error: "Configure um preço e uma cota positiva de créditos para o plano Personalizado antes de criar o produto." }, { status: 400 })
    }

    if (!settings.enabled) {
      return NextResponse.json({ error: "Habilite a AbacatePay antes de criar produtos." }, { status: 400 })
    }

    if (link.productId) {
      return NextResponse.json({ productId: link.productId, settings: toPublicAbacatePaySettings(settings, getOrigin(request)) })
    }

    const created = await createAbacatePayProduct(settings, plan)
    const updated = await updateAbacatePaySettings({
      plans: {
        ...settings.plans,
        [planCode]: { ...link, productId: created.productId },
      },
    })

    return NextResponse.json({
      productId: created.productId,
      settings: toPublicAbacatePaySettings(updated, getOrigin(request)),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o produto na AbacatePay.",
    }, { status: 400 })
  }
}
