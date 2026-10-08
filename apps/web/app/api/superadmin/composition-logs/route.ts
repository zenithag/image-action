import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { listCompositionLogs, reconcileCompositionLog } from "@/lib/server/composition-logs"

export const runtime = "nodejs"

export async function GET() {
  const denied = await requireSuperadmin()
  if (denied) return denied
  return NextResponse.json({ entries: await listCompositionLogs() })
}

export async function POST(request: Request) {
  const denied = await requireSuperadmin()
  if (denied) return denied
  const parsed = z.object({ tenantSlug: z.string().trim().min(1).max(100), jobId: z.string().uuid() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
  try {
    const result = await reconcileCompositionLog(parsed.data.tenantSlug, parsed.data.jobId)
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 })
  } catch {
    return NextResponse.json({ error: "Não foi possível conferir o pedido. Tente novamente." }, { status: 502 })
  }
}
