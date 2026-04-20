import { NextResponse } from "next/server"

import type { TenantInput } from "@/lib/tenant-types"
import { deleteTenant, findTenant, updateTenant } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel processar o tenant."
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const tenant = await findTenant(id)

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  return NextResponse.json(tenant)
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const payload = await request.json() as Partial<TenantInput>
    const tenant = await updateTenant(id, payload)

    if (!tenant) {
      return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
    }

    return NextResponse.json(tenant)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const deleted = await deleteTenant(id)

  if (!deleted) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
