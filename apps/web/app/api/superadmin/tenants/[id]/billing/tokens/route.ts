import { NextResponse } from "next/server"

import { findTenant } from "@/lib/server/tenants-store"
import { getTenantTokenSnapshot } from "@/lib/server/token-ledger-store"

import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized
  const { id } = await context.params
  const tenant = await findTenant(id)

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  const snapshot = await getTenantTokenSnapshot(tenant.slug, 50)
  return NextResponse.json(snapshot)
}

export async function POST() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized
  return NextResponse.json({ error: "Créditos são liberados apenas mediante pagamento confirmado." }, { status: 403 })
}
