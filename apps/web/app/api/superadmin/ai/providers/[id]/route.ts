import { NextResponse } from "next/server"

import {
  readAiProviders,
  sanitizeAiProvider,
  updateAiProvider,
  writeAiProviders,
} from "@/lib/server/ai-providers-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const payload = await request.json().catch(() => null)
  const providers = await readAiProviders()
  const provider = providers.find((item) => item.id === id)

  if (!provider) {
    return NextResponse.json({ error: "Provider de IA nao encontrado." }, { status: 404 })
  }

  const updatedProvider = updateAiProvider(provider, payload || {})

  await writeAiProviders(providers.map((item) => item.id === id ? updatedProvider : item))

  return NextResponse.json(sanitizeAiProvider(updatedProvider))
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const providers = await readAiProviders()
  const nextProviders = providers.filter((provider) => provider.id !== id)

  if (nextProviders.length === providers.length) {
    return NextResponse.json({ error: "Provider de IA nao encontrado." }, { status: 404 })
  }

  await writeAiProviders(nextProviders)

  return NextResponse.json({ ok: true })
}
