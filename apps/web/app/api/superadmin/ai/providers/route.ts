import { NextResponse } from "next/server"

import {
  buildAiProvider,
  readAiProviders,
  sanitizeAiProvider,
  writeAiProviders,
} from "@/lib/server/ai-providers-store"

export const runtime = "nodejs"

export async function GET() {
  const providers = await readAiProviders()

  return NextResponse.json(providers.map(sanitizeAiProvider))
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)

  try {
    const provider = buildAiProvider(payload || {})
    const providers = await readAiProviders()

    await writeAiProviders([provider, ...providers])

    return NextResponse.json(sanitizeAiProvider(provider), { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o provider de IA.",
    }, { status: 400 })
  }
}
