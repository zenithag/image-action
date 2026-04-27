import { NextResponse } from "next/server"

import {
  incrementProviderUsage,
  readProviders,
  selectWhatsappProvider,
} from "@/lib/server/channel-providers-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import {
  type StoredTenantChannelInstance,
  readTenantInstances,
  sanitizeTenantInstance,
  updateTenantInstance,
  writeTenantInstances,
} from "@/lib/server/tenant-channel-instances-store"
import {
  configureUazapiWebhook,
  connectUazapiInstance,
  createUazapiInstance,
  getUazapiConnectionState,
  getUazapiInstance,
  normalizeQrCode,
} from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type CreateInstancePayload = {
  name?: unknown
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function toInstanceStatus(uazapiStatus: unknown, connected: boolean) {
  if (connected) {
    return "connected" as const
  }

  if (uazapiStatus === "connecting") {
    return "connecting" as const
  }

  if (uazapiStatus === "connected") {
    return "connected" as const
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

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const instances = await readTenantInstances()

  return NextResponse.json(
    instances
      .filter((instance) => instance.tenantSlug === slug && instance.channel === "whatsapp")
      .map(sanitizeTenantInstance)
  )
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const settings = await getTenantSettings(slug)

  if (!settings.channels.whatsappEnabled) {
    return NextResponse.json({
      error: "O canal WhatsApp deste tenant esta desabilitado nas configuracoes.",
    }, { status: 409 })
  }

  const payload = await request.json() as CreateInstancePayload
  const name = asTrimmedString(payload.name)

  if (!name) {
    return NextResponse.json({ error: "Nome da instancia e obrigatorio." }, { status: 400 })
  }

  const providers = await readProviders()
  const provider = selectWhatsappProvider(providers)

  if (!provider) {
    return NextResponse.json({
      error: "Nao ha provider UAZAPI ativo com capacidade disponivel.",
    }, { status: 409 })
  }

  const instances = await readTenantInstances()
  const duplicatedName = instances.some((instance) =>
    instance.tenantSlug === slug &&
    instance.channel === "whatsapp" &&
    instance.name.toLowerCase() === name.toLowerCase()
  )

  if (duplicatedName) {
    return NextResponse.json({ error: "Ja existe uma instancia WhatsApp com esse nome neste tenant." }, { status: 409 })
  }

  try {
    const created = await createUazapiInstance(provider, slug, name)
    const createdInstance = getUazapiInstance(created)
    const instanceToken = created.token ?? createdInstance.token

    if (!instanceToken) {
      return NextResponse.json({
        error: "A UAZAPI criou a instancia, mas nao retornou o token da instancia.",
      }, { status: 502 })
    }

    const now = new Date().toISOString()

    const storedInstance: StoredTenantChannelInstance = {
      id: crypto.randomUUID(),
      tenantSlug: slug,
      channel: "whatsapp",
      providerId: provider.id,
      providerName: provider.name,
      name,
      externalId: createdInstance.id,
      externalName: createdInstance.name ?? name,
      instanceToken,
      status: toInstanceStatus(createdInstance.status, created.connected ?? false),
      connected: created.connected ?? false,
      loggedIn: created.loggedIn ?? false,
      qrcode: normalizeQrCode(createdInstance.qrcode),
      paircode: createdInstance.paircode,
      profileName: createdInstance.profileName,
      profilePicUrl: createdInstance.profilePicUrl,
      createdAt: now,
      updatedAt: now,
    }

    await writeTenantInstances([storedInstance, ...instances])
    await incrementProviderUsage(provider.id)

    try {
      const connected = await connectUazapiInstance(provider, instanceToken)
      const connectedInstance = getUazapiInstance(connected)
      const connectionState = getUazapiConnectionState(connected)
      const webhookUrl = getPublicWebhookUrl(storedInstance.id)
      let webhookError: string | undefined

      if (webhookUrl) {
        try {
          await configureUazapiWebhook(provider, instanceToken, webhookUrl)
        } catch (error) {
          webhookError = getErrorMessage(error)
        }
      }

      const connectedStoredInstance = await updateTenantInstance(slug, storedInstance.id, (instance) => ({
        ...instance,
        externalId: instance.externalId ?? connectedInstance.id,
        externalName: instance.externalName ?? connectedInstance.name ?? name,
        status: toInstanceStatus(connectedInstance.status ?? createdInstance.status, connectionState.connected),
        connected: connectionState.connected,
        loggedIn: connectionState.loggedIn,
        qrcode: normalizeQrCode(connectedInstance.qrcode),
        paircode: connectedInstance.paircode,
        profileName: connectedInstance.profileName,
        profilePicUrl: connectedInstance.profilePicUrl,
        phoneNumber: connectionState.phoneNumber,
        syncStartedAt: new Date().toISOString(),
        lastSyncedAt: undefined,
        lastError: webhookError,
        updatedAt: new Date().toISOString(),
      }))

      return NextResponse.json(sanitizeTenantInstance(connectedStoredInstance ?? storedInstance), { status: 201 })
    } catch (connectError) {
      const failedStoredInstance = await updateTenantInstance(slug, storedInstance.id, (instance) => ({
        ...instance,
        status: "error",
        lastError: connectError instanceof Error ? connectError.message : "Nao foi possivel gerar o QR Code.",
        updatedAt: new Date().toISOString(),
      }))

      return NextResponse.json(sanitizeTenantInstance(failedStoredInstance ?? storedInstance), { status: 201 })
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar a instancia WhatsApp.",
    }, { status: 502 })
  }
}
