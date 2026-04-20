import { NextResponse } from "next/server"

import { getActiveOpenRouterProvider, readAiProviders } from "@/lib/server/ai-providers-store"
import { listOpenRouterModels } from "@/lib/server/openrouter-client"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const providerId = url.searchParams.get("providerId")
  const providers = await readAiProviders()
  const provider = providerId
    ? providers.find((item) => item.id === providerId)
    : await getActiveOpenRouterProvider()

  if (!provider) {
    return NextResponse.json({ error: "Configure um provider OpenRouter ativo antes de sincronizar modelos." }, { status: 400 })
  }

  try {
    const models = await listOpenRouterModels(provider)

    return NextResponse.json({
      providerId: provider.id,
      models,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel listar modelos do OpenRouter.",
    }, { status: 400 })
  }
}
