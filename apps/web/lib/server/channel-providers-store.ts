import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

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

const dataFile = path.join(process.cwd(), ".local", "channel-providers.json")

export function sanitizeProvider(provider: StoredProvider) {
  const { adminToken: _adminToken, ...safeProvider } = provider

  return {
    ...safeProvider,
    adminTokenConfigured: Boolean(_adminToken),
  }
}

export async function readProviders() {
  try {
    const contents = await readFile(dataFile, "utf8")
    const parsed = JSON.parse(contents) as unknown

    return Array.isArray(parsed) ? parsed as StoredProvider[] : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }

    throw error
  }
}

export async function writeProviders(providers: StoredProvider[]) {
  await mkdir(path.dirname(dataFile), { recursive: true })
  await writeFile(dataFile, `${JSON.stringify(providers, null, 2)}\n`, "utf8")
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
