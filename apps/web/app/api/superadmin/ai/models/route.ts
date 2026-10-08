import { NextResponse } from "next/server"

import { getActiveOpenRouterProvider, readAiProviders } from "@/lib/server/ai-providers-store"
import { getUsdBrlExchangeRate, listOpenRouterModels } from "@/lib/server/openrouter-client"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const denied = await requireSuperadmin()
  if (denied) return denied
  const url = new URL(request.url)
  const providerId = url.searchParams.get("providerId")
  const providers = await readAiProviders()
  const provider = providerId
    ? providers.find((item) => item.id === providerId)
    : await getActiveOpenRouterProvider() || { id: "openrouter-public", baseUrl: "https://openrouter.ai/api/v1" }

  if (!provider) {
    return NextResponse.json({ error: "Configure um provider OpenRouter ativo antes de sincronizar modelos." }, { status: 400 })
  }

  try {
    const [models, exchangeRate] = await Promise.all([listOpenRouterModels(provider, true), getUsdBrlExchangeRate()])

    return NextResponse.json({
      providerId: provider.id,
      models,
      exchangeRate,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel listar modelos do OpenRouter.",
    }, { status: 400 })
  }
}
