import { NextResponse } from "next/server"

import { getTenantTokenSnapshot } from "@/lib/server/token-ledger-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const snapshot = await getTenantTokenSnapshot(slug, 20)

  return NextResponse.json(snapshot)
}
