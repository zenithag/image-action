import { NextResponse } from "next/server"

import type { ChannelPlanLimit } from "@/lib/channel-plan-types"
import { readChannelPlanLimits, updateChannelPlanLimits } from "@/lib/server/channel-plan-limits-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type UpdatePayload = {
  plans?: Array<Partial<ChannelPlanLimit> & { planCode: ChannelPlanLimit["planCode"] }>
}

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const plans = await readChannelPlanLimits()
  return NextResponse.json(plans)
}

export async function PATCH(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const payload = await request.json().catch(() => null) as UpdatePayload | null

  if (!payload?.plans || !Array.isArray(payload.plans) || payload.plans.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um plano para atualizar." }, { status: 400 })
  }

  try {
    const plans = await updateChannelPlanLimits(payload.plans)
    return NextResponse.json(plans)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel atualizar os limites por plano.",
    }, { status: 400 })
  }
}
