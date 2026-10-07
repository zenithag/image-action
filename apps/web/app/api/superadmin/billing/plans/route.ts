import { NextResponse } from "next/server"

import type { PlanCatalogEntry } from "@/lib/billing-types"
import { createPlanCatalogEntry, getPlanCatalog, updatePlanCatalog } from "@/lib/server/billing-store"
import { readChannelPlanLimits, updateChannelPlanLimits } from "@/lib/server/channel-plan-limits-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized
  return NextResponse.json(Object.values(await getPlanCatalog()))
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized
  try {
    const payload = await request.json() as { planCode?: unknown; productName?: unknown; description?: unknown }
    if (typeof payload.planCode !== "string" || typeof payload.productName !== "string") {
      return NextResponse.json({ error: "Informe o código e o nome do plano." }, { status: 400 })
    }
    const plan = await createPlanCatalogEntry({
      planCode: payload.planCode,
      productName: payload.productName,
      description: typeof payload.description === "string" ? payload.description : "",
    })
    await updateChannelPlanLimits([{
      planCode: plan.planCode,
      label: plan.productName,
      whatsapp: 0,
      instagram: 0,
      telegram: 0,
      catalogIncluded: false,
      conversationsLimit: 0,
      extra: "Configure os limites deste plano.",
    }])
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o plano." }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized
  try {
    const payload = await request.json() as { plans?: unknown }
    if (!Array.isArray(payload.plans) || payload.plans.length === 0) {
      return NextResponse.json({ error: "Informe ao menos um plano." }, { status: 400 })
    }
    const plans = payload.plans.flatMap((value) => {
      const plan = value as Partial<PlanCatalogEntry> | null
      if (!plan || typeof plan.planCode !== "string" || typeof plan.enabled !== "boolean") return []
      return [[plan.planCode, plan] as const]
    })
    if (plans.length !== payload.plans.length) {
      return NextResponse.json({ error: "Cada plano precisa ter código e estado de ativação válidos." }, { status: 400 })
    }
    const catalog = await updatePlanCatalog(Object.fromEntries(plans))
    const limits = await readChannelPlanLimits()
    await updateChannelPlanLimits(Object.values(catalog).map((plan) => ({
      ...(limits.find((limit) => limit.planCode === plan.planCode) ?? {}),
      planCode: plan.planCode,
      label: plan.productName,
    })))
    return NextResponse.json(Object.values(catalog))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar os planos." }, { status: 400 })
  }
}
