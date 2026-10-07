import { NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { listTenantNiches, saveTenantNiche } from "@/lib/server/tenant-niches-store"
export async function GET() {
  const denied = await requireSuperadmin()
  if (denied) return denied
  return NextResponse.json(await listTenantNiches())
}
export async function POST(request: Request) {
  const denied = await requireSuperadmin()
  if (denied) return denied
  try { return NextResponse.json(await saveTenantNiche(await request.json())) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar o nicho." }, { status: 400 }) }
}
