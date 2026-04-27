import { NextResponse } from "next/server"

import type { StripeSettings } from "@/lib/billing-types"
import { getStripeSettings, toPublicStripeSettings, updateStripeSettings } from "@/lib/server/billing-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

function getOrigin(request: Request) {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export async function GET(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const settings = await getStripeSettings()
  return NextResponse.json(toPublicStripeSettings(settings, getOrigin(request)))
}

export async function PUT(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json().catch(() => null) as (Partial<StripeSettings> & {
      clearSecretKey?: boolean
      clearWebhookSecret?: boolean
    }) | null

    if (!payload) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
    }

    const updated = await updateStripeSettings(payload)
    return NextResponse.json(toPublicStripeSettings(updated, getOrigin(request)))
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao do Stripe.",
    }, { status: 400 })
  }
}
