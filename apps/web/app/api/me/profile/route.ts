import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { getStoredAuthUserById, updateOwnProfile } from "@/lib/server/auth-users-store"
import { requireOwnUser } from "@/lib/server/own-user"

export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  const id = session?.user?.id

  if (!id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 })

  const user = await getStoredAuthUserById(id)

  return NextResponse.json({
    managed: Boolean(user),
    name: user?.name ?? session.user.name ?? "",
    email: user?.email ?? session.user.email ?? "",
    avatarUrl: user?.avatarUrl ?? "",
    tenantSlug: user?.tenantSlug ?? session.user.tenantSlug ?? null,
  })
}

export async function PATCH(request: Request) {
  const { user, response } = await requireOwnUser()
  if (!user) return response

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; avatarUrl?: unknown }

  try {
    const updated = await updateOwnProfile(user.id, { name: body.name, avatarUrl: body.avatarUrl })
    return NextResponse.json({ name: updated?.name, email: updated?.email, avatarUrl: updated?.avatarUrl ?? "" })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar." }, { status: 400 })
  }
}
