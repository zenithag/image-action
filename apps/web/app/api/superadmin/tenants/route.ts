import { NextResponse } from "next/server"

import type { TenantInput } from "@/lib/tenant-types"
import { createTenant, listTenants } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel processar o tenant."
}

export async function GET() {
  const tenants = await listTenants()
  return NextResponse.json(tenants)
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as TenantInput
    const tenant = await createTenant(payload)

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}
