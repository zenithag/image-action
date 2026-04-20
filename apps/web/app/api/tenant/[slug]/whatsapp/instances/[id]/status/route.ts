import { NextResponse } from "next/server"

import { readProviders } from "@/lib/server/channel-providers-store"
import {
  findTenantInstance,
  sanitizeTenantInstance,
  updateTenantInstance,
} from "@/lib/server/tenant-channel-instances-store"
import {
  getUazapiConnectionState,
  getUazapiInstance,
  getUazapiInstanceStatus,
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

  if (uazapiStatus === "disconnected") {
    return "disconnected" as const
  }

  return "error" as const
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const instance = await findTenantInstance(slug, id)

  if (!instance) {
    return NextResponse.json({ error: "Instancia nao encontrada." }, { status: 404 })
  }

  const providers = await readProviders()
  const provider = providers.find((item) => item.id === instance.providerId)

  if (!provider) {
    return NextResponse.json({ error: "Provider da instancia nao encontrado." }, { status: 404 })
  }

  try {
    const response = await getUazapiInstanceStatus(provider, instance.instanceToken)
    const instancePayload = getUazapiInstance(response)
    const connectionState = getUazapiConnectionState(response)

    const updatedInstance = await updateTenantInstance(slug, id, (current) => ({
      ...current,
      status: toInstanceStatus(instancePayload.status, connectionState.connected),
      connected: connectionState.connected,
      loggedIn: connectionState.loggedIn,
      qrcode: normalizeQrCode(instancePayload.qrcode) ?? current.qrcode,
      paircode: instancePayload.paircode ?? current.paircode,
      profileName: instancePayload.profileName ?? current.profileName,
      profilePicUrl: instancePayload.profilePicUrl ?? current.profilePicUrl,
      phoneNumber: connectionState.phoneNumber ?? current.phoneNumber,
      lastError: undefined,
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json(sanitizeTenantInstance(updatedInstance!))
  } catch (error) {
    const updatedInstance = await updateTenantInstance(slug, id, (current) => ({
      ...current,
      status: "error",
      lastError: error instanceof Error ? error.message : "Erro ao consultar status.",
      updatedAt: new Date().toISOString(),
    }))

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel consultar o status.",
      instance: updatedInstance ? sanitizeTenantInstance(updatedInstance) : undefined,
    }, { status: 502 })
  }
}
