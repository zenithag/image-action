import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isSuperadmin } from "@/lib/auth-routing"

export async function requireSuperadmin() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Autenticacao obrigatoria." }, { status: 401 })
  }

  if (!isSuperadmin(session.user.roles)) {
    return NextResponse.json({ error: "Acesso restrito ao superadmin." }, { status: 403 })
  }

  return null
}
