import { NextResponse } from "next/server"

import type { TenantSettingsInput } from "@/lib/tenant-settings-types"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { getTenantSettings, updateTenantSettings } from "@/lib/server/tenant-settings-store"
import { findTenant } from "@/lib/server/tenants-store"

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

  const settings = await getTenantSettings(tenant.slug)
  return NextResponse.json(settings)
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const { id } = await context.params
  const tenant = await findTenant(id)

  if (!tenant) {
    return NextResponse.json({ error: "Tenant nao encontrado." }, { status: 404 })
  }

  try {
    const payload = await request.json() as TenantSettingsInput
    const settings = await updateTenantSettings(tenant.slug, payload)

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes do tenant.",
    }, { status: 400 })
  }
}
