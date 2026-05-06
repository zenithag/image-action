import { NextResponse } from "next/server"

import { createCreditCoupon, listCreditCoupons } from "@/lib/server/commercial-benefits-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  return NextResponse.json(await listCreditCoupons())
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json().catch(() => null) as {
      code?: unknown
      creditAmount?: unknown
      status?: unknown
      expiresAt?: unknown
      maxRedemptions?: unknown
      maxRedemptionsPerTenant?: unknown
      notes?: unknown
    } | null
    const coupon = await createCreditCoupon({
      code: typeof payload?.code === "string" ? payload.code : "",
      creditAmount: Number(payload?.creditAmount),
      status: payload?.status === "inactive" ? "inactive" : "active",
      expiresAt: typeof payload?.expiresAt === "string" ? payload.expiresAt : undefined,
      maxRedemptions: payload?.maxRedemptions === undefined || payload.maxRedemptions === "" ? undefined : Number(payload.maxRedemptions),
      maxRedemptionsPerTenant: payload?.maxRedemptionsPerTenant === undefined || payload.maxRedemptionsPerTenant === "" ? undefined : Number(payload.maxRedemptionsPerTenant),
      notes: typeof payload?.notes === "string" ? payload.notes : undefined,
    })

    return NextResponse.json(coupon, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível criar o cupom.",
    }, { status: 400 })
  }
}
