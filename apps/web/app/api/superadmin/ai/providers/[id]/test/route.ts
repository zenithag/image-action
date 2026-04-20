import { NextResponse } from "next/server"

import type { AiCreditStatus, AiProvider, AiProviderTestResult } from "@/lib/ai-types"
import { readAiProviders, sanitizeAiProvider, writeAiProviders } from "@/lib/server/ai-providers-store"
import { getOpenRouterCredits, listOpenRouterModels } from "@/lib/server/openrouter-client"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const providers = await readAiProviders()
  const provider = providers.find((item) => item.id === id)

  if (!provider) {
    return NextResponse.json({ error: "Provider de IA nao encontrado." }, { status: 404 })
  }

  const startedAt = Date.now()

  try {
    const [modelsResult, creditsResult] = await Promise.allSettled([
      listOpenRouterModels(provider),
      getOpenRouterCredits(provider),
    ])

    if (modelsResult.status === "rejected") {
      throw modelsResult.reason
    }

    const models = modelsResult.value
    const latencyMs = Date.now() - startedAt
    const credits = creditsResult.status === "fulfilled" ? creditsResult.value : null
    const creditError = creditsResult.status === "rejected" ? creditsResult.reason : null
    const remainingCreditsUsd = credits ? credits.remainingCreditsUsd : undefined
    const creditStatus: AiCreditStatus = credits
      ? credits.remainingCreditsUsd <= 0 ? "empty" : "available"
      : "unavailable"
    const creditMessage = credits
      ? credits.remainingCreditsUsd <= 0
        ? "Provider sem creditos disponiveis no OpenRouter."
        : "Saldo OpenRouter consultado com sucesso."
      : creditError instanceof Error && "status" in creditError && creditError.status === 403
        ? "Nao foi possivel consultar creditos: o endpoint /credits exige uma Management Key do OpenRouter."
        : creditError instanceof Error
          ? `Nao foi possivel consultar creditos: ${creditError.message}`
          : "Nao foi possivel consultar creditos."
    const result: AiProviderTestResult = {
      ok: creditStatus !== "empty",
      status: creditStatus === "available" ? "success" : creditStatus === "empty" ? "error" : "warning",
      message: creditStatus === "available"
        ? "Conexao OpenRouter validada com creditos disponiveis."
        : creditStatus === "empty"
          ? "Conexao OpenRouter validada, mas o provider esta sem creditos."
          : "Conexao OpenRouter validada, mas o saldo nao pode ser consultado.",
      latencyMs,
      modelCount: models.length,
      creditStatus,
      totalCreditsUsd: credits?.totalCreditsUsd,
      totalUsageUsd: credits?.totalUsageUsd,
      remainingCreditsUsd,
      creditMessage,
      checkedAt: new Date().toISOString(),
    }
    const nextProvider = {
      ...provider,
      health: creditStatus === "available" ? "ok" as const : creditStatus === "empty" ? "error" as const : "warning" as const,
      lastCreditStatus: creditStatus,
      lastTotalCreditsUsd: credits?.totalCreditsUsd,
      lastTotalUsageUsd: credits?.totalUsageUsd,
      lastRemainingCreditsUsd: remainingCreditsUsd,
      creditsCheckedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies AiProvider

    await writeAiProviders(providers.map((item) => item.id === id ? nextProvider : item))

    return NextResponse.json({ ...result, provider: sanitizeAiProvider(nextProvider) })
  } catch (error) {
    const result: AiProviderTestResult = {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Nao foi possivel conectar ao OpenRouter.",
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    }
    const nextProvider = {
      ...provider,
      health: "error" as const,
      updatedAt: new Date().toISOString(),
    }

    await writeAiProviders(providers.map((item) => item.id === id ? nextProvider : item))

    return NextResponse.json({ ...result, provider: sanitizeAiProvider(nextProvider) }, { status: 400 })
  }
}
