import { NextResponse } from "next/server"

import type { TenantInput } from "@/lib/tenant-types"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { createTenant, listTenants } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel processar o tenant."
}

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const tenants = await listTenants()
  return NextResponse.json(tenants)
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json() as TenantInput
    const tenant = await createTenant(payload)

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}
