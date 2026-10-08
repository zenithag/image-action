import { NextResponse } from "next/server"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

import {
  buildAiModelProfile,
  readAiModelProfiles,
  validateAiModelProfile,
  writeAiModelProfiles,
} from "@/lib/server/ai-model-profiles-store"

export const runtime = "nodejs"

export async function GET() {
  const profiles = await readAiModelProfiles()

  return NextResponse.json(profiles)
}

export async function POST(request: Request) {
  const denied = await requireSuperadmin()
  if (denied) return denied
  const payload = await request.json().catch(() => null)

  try {
    const profile = buildAiModelProfile(payload || {})
    await validateAiModelProfile(profile)
    const profiles = await readAiModelProfiles()

    await writeAiModelProfiles([profile, ...profiles])

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o perfil de modelo.",
    }, { status: 400 })
  }
}
