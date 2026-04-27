import { NextResponse } from "next/server"

import { type StoredProvider, readProviders } from "@/lib/server/channel-providers-store"
import {
  sanitizeTenantInstance,
  updateTenantInstance,
} from "@/lib/server/tenant-channel-instances-store"
import {
  configureUazapiWebhook,
  connectUazapiInstance,
  getUazapiConnectionState,
  getUazapiInstance,
  normalizeQrCode,
} from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

function toInstanceStatus(uazapiStatus: unknown, connected: boolean) {
  if (connected || uazapiStatus === "connected") {
    return "connected" as const
  }

  if (uazapiStatus === "connecting") {
    return "connecting" as const
  }

  return "disconnected" as const
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel configurar o webhook da UAZAPI."
}

function getPublicWebhookUrl(channelInstanceId: string) {
  const publicBaseUrl = (
    process.env.APP_PUBLIC_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL
  )

  if (!publicBaseUrl || publicBaseUrl.includes("localhost") || publicBaseUrl.includes("127.0.0.1")) {
    return null
  }

  const url = new URL("/api/webhooks/uazapi", publicBaseUrl)
  url.searchParams.set("channelInstanceId", channelInstanceId)

  return url.toString()
}

export async function POST(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const providers = await readProviders()
  let provider: StoredProvider | null = null
  let token = ""

  const pendingInstance = await updateTenantInstance(slug, id, (instance) => {
    token = instance.instanceToken
    provider = providers.find((item) => item.id === instance.providerId) ?? null

    return {
      ...instance,
      status: "connecting",
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }
  })

  if (!pendingInstance) {
    return NextResponse.json({ error: "Instancia nao encontrada." }, { status: 404 })
  }

  if (!provider) {
    return NextResponse.json({ error: "Provider da instancia nao encontrado." }, { status: 404 })
  }

  try {
    const response = await connectUazapiInstance(provider, token)
    const instancePayload = getUazapiInstance(response)
    const connectionState = getUazapiConnectionState(response)
    const webhookUrl = getPublicWebhookUrl(id)
    let webhookError: string | undefined

    if (webhookUrl) {
      try {
        await configureUazapiWebhook(provider, token, webhookUrl)
      } catch (error) {
        webhookError = getErrorMessage(error)
      }
    }

    const updatedInstance = await updateTenantInstance(slug, id, (instance) => ({
      ...instance,
      status: toInstanceStatus(instancePayload.status, connectionState.connected),
      connected: connectionState.connected,
      loggedIn: connectionState.loggedIn,
      qrcode: normalizeQrCode(instancePayload.qrcode),
      paircode: instancePayload.paircode,
      profileName: instancePayload.profileName ?? instance.profileName,
      profilePicUrl: instancePayload.profilePicUrl ?? instance.profilePicUrl,
      phoneNumber: connectionState.phoneNumber ?? instance.phoneNumber,
      syncStartedAt: connectionState.connected ? new Date().toISOString() : instance.syncStartedAt,
      lastSyncedAt: connectionState.connected ? undefined : instance.lastSyncedAt,
      lastError: webhookError,
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json(sanitizeTenantInstance(updatedInstance!))
  } catch (error) {
    const updatedInstance = await updateTenantInstance(slug, id, (instance) => ({
      ...instance,
      status: "error",
      lastError: error instanceof Error ? error.message : "Erro ao gerar QR Code.",
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel gerar o QR Code.",
      instance: updatedInstance ? sanitizeTenantInstance(updatedInstance) : undefined,
    }, { status: 502 })
  }
}
