import { NextResponse } from "next/server"

import { getTenantReferralProgram } from "@/lib/server/commercial-benefits-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  return NextResponse.json(await getTenantReferralProgram(slug))
}
