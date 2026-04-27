import { NextResponse } from "next/server"

import { findTenant } from "@/lib/server/tenants-store"
import { getTenantTokenSnapshot, grantTenantManualTokens } from "@/lib/server/token-ledger-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

type CreditPayload = {
  amount?: unknown
  description?: unknown
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const tenant = await findTenant(id)

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  const snapshot = await getTenantTokenSnapshot(tenant.slug, 50)
  return NextResponse.json(snapshot)
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const tenant = await findTenant(id)

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  const payload = await request.json().catch(() => null) as CreditPayload | null
  const amount = Number(payload?.amount)

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Informe uma quantidade positiva de tokens." }, { status: 400 })
  }

  try {
    const result = await grantTenantManualTokens({
      tenantSlug: tenant.slug,
      amount,
      description: typeof payload?.description === "string" ? payload.description : "",
      createdBy: "superadmin",
      referenceId: tenant.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel liberar os tokens.",
    }, { status: 400 })
  }
}
