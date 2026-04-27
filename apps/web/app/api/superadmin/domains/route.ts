import { NextResponse } from "next/server"

import type { SuperadminDomainInput } from "@/lib/domain-types"
import { createDomain, listDomains } from "@/lib/server/domains-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const domains = await listDomains()
  return NextResponse.json(domains)
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const payload = await request.json().catch(() => null) as SuperadminDomainInput | null
  if (!payload) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 })
  }

  try {
    const domain = await createDomain(payload)
    return NextResponse.json(domain, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Não foi possível cadastrar o domínio.",
    }, { status: 400 })
  }
}
