import { NextResponse } from "next/server"

import { readProviders, writeProviders } from "@/lib/server/channel-providers-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const providers = await readProviders()
  const nextProviders = providers.filter((provider) => provider.id !== id)

  if (nextProviders.length === providers.length) {
    return NextResponse.json({ error: "Provider nao encontrado." }, { status: 404 })
  }

  await writeProviders(nextProviders)

  return NextResponse.json({ ok: true })
}
