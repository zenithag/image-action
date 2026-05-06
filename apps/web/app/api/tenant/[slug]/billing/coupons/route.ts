import { NextResponse } from "next/server"

import { redeemCreditCoupon } from "@/lib/server/commercial-benefits-store"
import { getTenantTokenSnapshot } from "@/lib/server/token-ledger-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params

  try {
    const payload = await request.json().catch(() => null) as { code?: unknown } | null
    const result = await redeemCreditCoupon(slug, typeof payload?.code === "string" ? payload.code : "")
    const tokenSnapshot = await getTenantTokenSnapshot(slug, 20)

    return NextResponse.json({
      coupon: result.coupon,
      redemption: result.redemption,
      tokenSnapshot,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível aplicar o cupom.",
    }, { status: 400 })
  }
}
