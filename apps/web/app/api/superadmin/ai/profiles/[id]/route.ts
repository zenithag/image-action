import { NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

import {
  readAiModelProfiles,
  updateAiModelProfile,
  writeAiModelProfiles,
} from "@/lib/server/ai-model-profiles-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireSuperadmin()
  if (denied) return denied
  const { id } = await context.params
  const payload = await request.json().catch(() => null)
  const profiles = await readAiModelProfiles()
  const profile = profiles.find((item) => item.id === id)

  if (!profile) {
    return NextResponse.json({ error: "Perfil de modelo nao encontrado." }, { status: 404 })
  }

  const updatedProfile = updateAiModelProfile(profile, payload || {})

  await writeAiModelProfiles(profiles.map((item) => item.id === id ? updatedProfile : item))

  return NextResponse.json(updatedProfile)
}

export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireSuperadmin()
  if (denied) return denied
  const { id } = await context.params
  const profiles = await readAiModelProfiles()
  const nextProfiles = profiles.filter((profile) => profile.id !== id)

  if (nextProfiles.length === profiles.length) {
    return NextResponse.json({ error: "Perfil de modelo nao encontrado." }, { status: 404 })
  }

  await writeAiModelProfiles(nextProfiles)

  return NextResponse.json({ ok: true })
}
