import { NextResponse } from "next/server"

import {
  decrementProviderUsage,
  readProviders,
} from "@/lib/server/channel-providers-store"
import {
  deleteTenantInstance,
  findTenantInstance,
} from "@/lib/server/tenant-channel-instances-store"
import { purgeInboxForChannelInstance } from "@/lib/server/inbox-store"
import { UazapiError, deleteUazapiInstance } from "@/lib/server/uazapi-client"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const instance = await findTenantInstance(slug, id)

  if (!instance) {
    return NextResponse.json({ error: "Instancia nao encontrada." }, { status: 404 })
  }

  const providers = await readProviders()
  const provider = providers.find((item) => item.id === instance.providerId)
  let remoteDeleteWarning: string | undefined

  if (provider) {
    try {
      await deleteUazapiInstance(provider, instance.instanceToken)
    } catch (error) {
      const alreadyRemoved = error instanceof UazapiError && error.httpStatus === 404

      if (!alreadyRemoved) {
        remoteDeleteWarning = error instanceof Error
          ? error.message
          : "Nao foi possivel remover a instancia no provedor."
      }
    }
  }

  const deletedInstance = await deleteTenantInstance(slug, id)

  if (!deletedInstance) {
    return NextResponse.json({ error: "Instancia nao encontrada." }, { status: 404 })
  }

  await decrementProviderUsage(deletedInstance.providerId)
  await purgeInboxForChannelInstance(slug, deletedInstance.id)

  return NextResponse.json({
    ok: true,
    removedId: deletedInstance.id,
    remoteDeleted: !remoteDeleteWarning,
    warning: remoteDeleteWarning,
  })
}
