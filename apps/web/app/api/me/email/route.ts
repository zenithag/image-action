import { NextResponse } from "next/server"

import { changeOwnEmail } from "@/lib/server/auth-users-store"
import { requireOwnUser } from "@/lib/server/own-user"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const { user, response } = await requireOwnUser()
  if (!user) return response

  const body = (await request.json().catch(() => ({}))) as { newEmail?: unknown; currentPassword?: unknown }

  try {
    const updated = await changeOwnEmail(user.id, { newEmail: body.newEmail, currentPassword: body.currentPassword })
    return NextResponse.json({ email: updated?.email })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível alterar o e-mail." }, { status: 400 })
  }
}
