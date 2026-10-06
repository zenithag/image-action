export type TenantChannelAvailability = {
  configured: boolean
  connection: "not-configured" | "connected" | "connecting" | "disconnected" | "error"
  recordedAt: string | null
}

type InstanceSnapshot = {
  tenantSlug: string
  channel: string
  instanceToken: string
  status: string
  connected: boolean
  loggedIn: boolean
  updatedAt: string
}

// A stored connection is evidence of its last observation, not a live provider probe.
export function summarizeWhatsappAvailability(instances: InstanceSnapshot[], tenantSlug: string): TenantChannelAvailability {
  const configured = instances.filter(instance => instance.tenantSlug === tenantSlug && instance.channel === "whatsapp" && Boolean(instance.instanceToken?.trim()))
  const connected = configured.filter(instance => instance.status === "connected" && instance.connected && instance.loggedIn)
  const selected = connected.length ? connected : configured
  const recordedAt = selected.map(instance => instance.updatedAt).filter(value => Number.isFinite(Date.parse(value))).sort().at(-1) ?? null
  const connection = !configured.length ? "not-configured"
    : connected.length ? "connected"
    : configured.some(instance => instance.status === "connecting") ? "connecting"
    : configured.some(instance => instance.status === "error") ? "error"
    : "disconnected"
  return { configured: configured.length > 0, connection, recordedAt }
}
