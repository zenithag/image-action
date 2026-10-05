import { NextResponse } from "next/server"

import { changeOwnPassword } from "@/lib/server/auth-users-store"
import { requireOwnUser } from "@/lib/server/own-user"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { user, response } = await requireOwnUser()
  if (!user) return response

  const body = (await request.json().catch(() => ({}))) as { currentPassword?: unknown; newPassword?: unknown }

  try {
    await changeOwnPassword(user.id, { currentPassword: body.currentPassword, newPassword: body.newPassword })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível alterar a senha." }, { status: 400 })
  }
}
