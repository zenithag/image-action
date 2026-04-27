import { NextResponse } from "next/server"

import { readTenantInstances, sanitizeTenantInstance } from "@/lib/server/tenant-channel-instances-store"
import { listTenants } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

function formatInstanceStatus(status: "disconnected" | "connecting" | "connected" | "error", connected: boolean) {
  if (status === "error") return "error" as const
  if (connected || status === "connected") return "connected" as const
  return "pending" as const
}

export async function GET() {
  const [tenants, instances] = await Promise.all([
    listTenants(),
    readTenantInstances(),
  ])
  const tenantBySlug = new Map(tenants.map((tenant) => [tenant.slug, tenant]))

  return NextResponse.json(
    instances.map((instance) => {
      const tenant = tenantBySlug.get(instance.tenantSlug)
      const safeInstance = sanitizeTenantInstance(instance)

      return {
        id: safeInstance.id,
        tenantId: tenant?.id,
        tenant: tenant?.name || safeInstance.tenantSlug,
        tenantSlug: safeInstance.tenantSlug,
        channel: safeInstance.channel,
        providerAccount: safeInstance.providerName,
        label: safeInstance.name,
        plan: tenant?.planCode || "starter",
        status: formatInstanceStatus(safeInstance.status, safeInstance.connected),
        phoneNumber: safeInstance.phoneNumber,
        connected: safeInstance.connected,
        loggedIn: safeInstance.loggedIn,
        createdAt: safeInstance.createdAt,
      }
    })
  )
}
