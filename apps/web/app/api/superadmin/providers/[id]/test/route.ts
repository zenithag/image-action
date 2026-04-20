import { NextResponse } from "next/server"

import { readProviders } from "@/lib/server/channel-providers-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

function appendPath(baseUrl: string, pathname: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`
}

function getResponseMessage(status: number, body: unknown) {
  if (status === 200) {
    return "Conexao validada com sucesso."
  }

  if (status === 401 || status === 403) {
    return "Servidor respondeu, mas o admin token foi recusado."
  }

  if (status === 404) {
    return "Servidor respondeu 404. Verifique se a Base URL aponta para a API UAZAPI correta."
  }

  if (typeof body === "object" && body && "message" in body) {
    return String((body as { message?: unknown }).message || `Servidor respondeu HTTP ${status}.`)
  }

  if (typeof body === "object" && body && "error" in body) {
    return String((body as { error?: unknown }).error || `Servidor respondeu HTTP ${status}.`)
  }

  return `Servidor respondeu HTTP ${status}.`
}

async function readBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text.slice(0, 240)
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const providers = await readProviders()
  const provider = providers.find((item) => item.id === id)

  if (!provider) {
    return NextResponse.json({ error: "Provider nao encontrado." }, { status: 404 })
  }

  if (provider.provider !== "uazapi") {
    return NextResponse.json({
      ok: false,
      status: "warning",
      message: "Teste automatico ainda esta disponivel apenas para UAZAPI.",
      checkedAt: new Date().toISOString(),
    }, { status: 400 })
  }

  if (!provider.baseUrl || !provider.adminToken) {
    return NextResponse.json({
      ok: false,
      status: "error",
      message: "Base URL e admin token precisam estar configurados.",
      checkedAt: new Date().toISOString(),
    }, { status: 400 })
  }

  const endpoint = appendPath(provider.baseUrl, "/instance/all")
  const startedAt = Date.now()

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        admintoken: provider.adminToken,
      },
      signal: AbortSignal.timeout(15000),
    })
    const latencyMs = Date.now() - startedAt
    const body = await readBody(response)
    const instanceCount = Array.isArray(body)
      ? body.length
      : typeof body === "object" && body && Array.isArray((body as { data?: unknown }).data)
        ? ((body as { data: unknown[] }).data).length
        : undefined

    return NextResponse.json({
      ok: response.ok,
      status: response.ok ? "success" : "error",
      message: getResponseMessage(response.status, body),
      httpStatus: response.status,
      latencyMs,
      instanceCount,
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError"

    return NextResponse.json({
      ok: false,
      status: "error",
      message: isTimeout
        ? "Timeout ao testar conexao com o provider."
        : "Nao foi possivel conectar ao provider. Verifique URL, DNS e TLS.",
      checkedAt: new Date().toISOString(),
    })
  }
}
