import { NextResponse } from "next/server"

import { deleteDomain } from "@/lib/server/domains-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const { id } = await context.params
  const deleted = await deleteDomain(id)
  if (!deleted) {
    return NextResponse.json({ error: "Domínio não encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
