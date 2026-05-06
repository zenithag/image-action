import { NextResponse } from "next/server"

import { updateCreditCoupon } from "@/lib/server/commercial-benefits-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    const payload = await request.json().catch(() => null) as {
      code?: unknown
      creditAmount?: unknown
      status?: unknown
      expiresAt?: unknown
      maxRedemptions?: unknown
      maxRedemptionsPerTenant?: unknown
      notes?: unknown
    } | null
    const coupon = await updateCreditCoupon(id, {
      code: typeof payload?.code === "string" ? payload.code : undefined,
      creditAmount: payload?.creditAmount === undefined ? undefined : Number(payload.creditAmount),
      status: payload?.status === "inactive" ? "inactive" : payload?.status === "active" ? "active" : undefined,
      expiresAt: typeof payload?.expiresAt === "string" ? payload.expiresAt : undefined,
      maxRedemptions: payload?.maxRedemptions === undefined || payload.maxRedemptions === "" ? undefined : Number(payload.maxRedemptions),
      maxRedemptionsPerTenant: payload?.maxRedemptionsPerTenant === undefined || payload.maxRedemptionsPerTenant === "" ? undefined : Number(payload.maxRedemptionsPerTenant),
      notes: typeof payload?.notes === "string" ? payload.notes : undefined,
    })

    if (!coupon) {
      return NextResponse.json({ error: "Cupom não encontrado." }, { status: 404 })
    }

    return NextResponse.json(coupon)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível atualizar o cupom.",
    }, { status: 400 })
  }
}
