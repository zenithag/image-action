import { NextResponse } from "next/server"

import {
  listTenantReferrals,
  updateReferralSettings,
} from "@/lib/server/commercial-benefits-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  return NextResponse.json(await listTenantReferrals())
}

export async function PUT(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json().catch(() => null) as {
      enabled?: unknown
      defaultCreditAmount?: unknown
    } | null
    const settings = await updateReferralSettings({
      enabled: typeof payload?.enabled === "boolean" ? payload.enabled : undefined,
      defaultCreditAmount: payload?.defaultCreditAmount === undefined ? undefined : Number(payload.defaultCreditAmount),
    })

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível salvar o programa de indicação.",
    }, { status: 400 })
  }
}
