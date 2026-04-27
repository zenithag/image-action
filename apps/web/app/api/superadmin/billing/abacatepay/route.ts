import { NextResponse } from "next/server"

import type { AbacatePaySettings } from "@/lib/billing-types"
import {
  getAbacatePaySettings,
  toPublicAbacatePaySettings,
  updateAbacatePaySettings,
} from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

function getOrigin(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const settings = await getAbacatePaySettings()
  return NextResponse.json(toPublicAbacatePaySettings(settings, getOrigin(request)))
}

export async function PUT(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json().catch(() => null) as (Partial<AbacatePaySettings> & { clearApiKey?: boolean }) | null

    if (!payload) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
    }

    const updated = await updateAbacatePaySettings(payload)
    return NextResponse.json(toPublicAbacatePaySettings(updated, getOrigin(request)))
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao de pagamento.",
    }, { status: 400 })
  }
}
