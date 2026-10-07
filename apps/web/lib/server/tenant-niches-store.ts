import { defaultTenantNiches, type TenantNiche } from "@/lib/tenant-niches"
import { readJsonStore, writeJsonStore, withJsonStoreLock } from "./postgres-json-store"
import { getRuntimeDataFile } from "./runtime-paths"
const filePath = getRuntimeDataFile("tenant-niches.json")
const options = { key: "tenant-niches", filePath, fallback: defaultTenantNiches }
export async function listTenantNiches(): Promise<TenantNiche[]> {
  return readJsonStore(options)
}
export async function saveTenantNiche(input: TenantNiche) {
  const code = typeof input.code === "string" ? input.code.trim() : ""
  const label = typeof input.label === "string" ? input.label.trim() : ""
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(code) || !label || label.length > 80) throw new Error("Informe um código válido e um nome de até 80 caracteres.")
  return withJsonStoreLock(options.key, filePath, async () => {
    const niches = await listTenantNiches()
    const next = niches.some(niche => niche.code === code) ? niches.map(niche => niche.code === code ? { code, label } : niche) : [...niches, { code, label }]
    await writeJsonStore(options, next)
    return next
  })
}
