import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getStoredAuthUserById } from "@/lib/server/auth-users-store"

/** The signed-in locally managed user, or an error response. SSO (Zitadel) users are not stored here. */
export async function requireOwnUser() {
  const session = await auth()
  const id = session?.user?.id

  if (!id) return { response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) }

  const user = await getStoredAuthUserById(id)

  if (!user) {
    return { response: NextResponse.json({ error: "Esta conta é gerenciada pelo provedor de login." }, { status: 409 }) }
  }

  return { user }
}
