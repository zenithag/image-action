import { NextResponse } from "next/server"

import type { TenantSettingsInput } from "@/lib/tenant-settings-types"
import { getTenantSettings, updateTenantSettings } from "@/lib/server/tenant-settings-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const settings = await getTenantSettings(slug)

  return NextResponse.json(settings)
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null) as TenantSettingsInput | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  try {
    const settings = await updateTenantSettings(slug, payload)

    return NextResponse.json(settings)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.",
    }, { status: 400 })
  }
}
