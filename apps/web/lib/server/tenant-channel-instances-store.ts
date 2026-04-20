import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

export type TenantChannelInstanceStatus = "disconnected" | "connecting" | "connected" | "error"

export type StoredTenantChannelInstance = {
  id: string
  tenantSlug: string
  channel: "whatsapp"
  providerId: string
  providerName: string
  name: string
  externalId?: string
  externalName?: string
  instanceToken: string
  status: TenantChannelInstanceStatus
  connected: boolean
  loggedIn: boolean
  qrcode?: string
  paircode?: string
  profileName?: string
  profilePicUrl?: string
  phoneNumber?: string
  syncStartedAt?: string
  lastSyncedAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

const dataFile = getRuntimeDataFile("tenant-channel-instances.json")
const storeKey = "tenant-channel-instances"

export function sanitizeTenantInstance(instance: StoredTenantChannelInstance) {
  const { instanceToken: _instanceToken, ...safeInstance } = instance

  return {
    ...safeInstance,
    instanceTokenConfigured: Boolean(_instanceToken),
  }
}

export async function readTenantInstances() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: [] as StoredTenantChannelInstance[],
    normalize: (parsed) => Array.isArray(parsed) ? parsed as StoredTenantChannelInstance[] : [],
  })
}

export async function writeTenantInstances(instances: StoredTenantChannelInstance[]) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: [] as StoredTenantChannelInstance[] }, instances)
}

export async function findTenantInstance(tenantSlug: string, id: string) {
  const instances = await readTenantInstances()

  return instances.find((instance) => instance.tenantSlug === tenantSlug && instance.id === id)
}

export async function updateTenantInstance(
  tenantSlug: string,
  id: string,
  updater: (instance: StoredTenantChannelInstance) => StoredTenantChannelInstance
) {
  const instances = await readTenantInstances()
  let updatedInstance: StoredTenantChannelInstance | null = null

  const nextInstances = instances.map((instance) => {
    if (instance.tenantSlug !== tenantSlug || instance.id !== id) {
      return instance
    }

    updatedInstance = updater(instance)
    return updatedInstance
  })

  if (!updatedInstance) {
    return null
  }

  await writeTenantInstances(nextInstances)
  return updatedInstance
}

export async function deleteTenantInstance(tenantSlug: string, id: string) {
  const instances = await readTenantInstances()
  const instance = instances.find((item) => item.tenantSlug === tenantSlug && item.id === id)

  if (!instance) {
    return null
  }

  await writeTenantInstances(instances.filter((item) => item.id !== id))
  return instance
}
