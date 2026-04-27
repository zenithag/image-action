import { NextResponse } from "next/server"

import { checkDomain } from "@/lib/server/domains-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const { id } = await context.params

  const domain = await checkDomain(id)
  if (!domain) {
    return NextResponse.json({ error: "Domínio não encontrado." }, { status: 404 })
  }

  return NextResponse.json(domain)
}
