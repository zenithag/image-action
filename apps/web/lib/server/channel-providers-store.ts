import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

export type ProviderStatus = "active" | "maintenance" | "disabled"
export type ChannelKind = "whatsapp" | "instagram" | "telegram"
export type ProviderKind = "uazapi" | "meta" | "telegram-bot-api"

export type StoredProvider = {
  id: string
  name: string
  kind: ChannelKind
  provider: ProviderKind
  status: ProviderStatus
  baseUrl?: string
  adminToken?: string
  contractedCapacity?: number
  reservedCapacity?: number
  usedCapacity: number
  health: "ok" | "warning" | "error"
  notes: string
  createdAt: string
}

const dataFile = getRuntimeDataFile("channel-providers.json")
const storeKey = "channel-providers"

export function sanitizeProvider(provider: StoredProvider) {
  const { adminToken: _adminToken, ...safeProvider } = provider

  return {
    ...safeProvider,
    adminTokenConfigured: Boolean(_adminToken),
  }
}

export async function readProviders() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: [] as StoredProvider[],
    normalize: (parsed) => Array.isArray(parsed) ? parsed as StoredProvider[] : [],
  })
}

export async function writeProviders(providers: StoredProvider[]) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: [] as StoredProvider[] }, providers)
}

export function getProviderAvailableCapacity(provider: StoredProvider) {
  return (provider.contractedCapacity ?? 0) - provider.usedCapacity - (provider.reservedCapacity ?? 0)
}

export function selectWhatsappProvider(providers: StoredProvider[]) {
  return providers
    .filter((provider) =>
      provider.kind === "whatsapp" &&
      provider.provider === "uazapi" &&
      provider.status === "active" &&
      Boolean(provider.baseUrl) &&
      Boolean(provider.adminToken) &&
      getProviderAvailableCapacity(provider) > 0
    )
    .sort((left, right) => {
      if (left.usedCapacity !== right.usedCapacity) {
        return left.usedCapacity - right.usedCapacity
      }

      return getProviderAvailableCapacity(right) - getProviderAvailableCapacity(left)
    })[0]
}

export async function incrementProviderUsage(providerId: string) {
  const providers = await readProviders()
  const nextProviders = providers.map((provider) =>
    provider.id === providerId
      ? { ...provider, usedCapacity: provider.usedCapacity + 1 }
      : provider
  )

  await writeProviders(nextProviders)
}

export async function decrementProviderUsage(providerId: string) {
  const providers = await readProviders()
  const nextProviders = providers.map((provider) =>
    provider.id === providerId
      ? { ...provider, usedCapacity: Math.max(0, provider.usedCapacity - 1) }
      : provider
  )

  await writeProviders(nextProviders)
}
