import { randomBytes, randomUUID, scryptSync } from "node:crypto"
import { readFile, writeFile, mkdir, rename } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const appDir = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(import.meta.url)
createRequire(require.resolve("next/package.json"))("@next/env").loadEnvConfig(appDir)
if (process.env.NODE_ENV === "production" || process.env.DATABASE_URL?.trim()) {
  throw new Error("Este seed é exclusivo para desenvolvimento local com armazenamento JSON.")
}
const dataDir = path.resolve(appDir, process.env.VISUALFLOW_DATA_DIR || ".local")
if (dataDir !== path.join(appDir, ".local")) throw new Error("O seed exige o diretório local padrão apps/web/.local.")

async function read(name, fallback) {
  try { return JSON.parse(await readFile(path.join(dataDir, name), "utf8")) }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error }
}
async function save(name, data) {
  const destination = path.join(dataDir, name)
  const temporary = `${destination}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(data, null, 2) + "\n", { flag: "wx" })
  await rename(temporary, destination)
}

const email = "studio@comofica.local"
const slug = "studio-demo"
const users = await read("auth-users.json", { users: [] })
const tenants = await read("tenants.json", { tenants: [] })
if (users.users.some(user => user.email === email)) throw new Error("O usuário de teste já existe; sua senha não foi alterada.")
if (tenants.tenants.some(tenant => tenant.slug === slug)) throw new Error("O tenant de teste já existe; nenhum acesso foi concedido a ele.")
const now = new Date().toISOString()
const tenantId = randomUUID()
const password = `Studio!9-${randomBytes(9).toString("base64url")}`
const passwordSalt = randomBytes(16).toString("base64url")
tenants.tenants.push({ id: tenantId, slug, name: "Studio de demonstração", status: "active", planCode: "starter", businessVertical: "decor", contactName: "Eduardo", contactEmail: email, stats: { conversations: 0, compositions: 0, contacts: 0 }, createdAt: now, updatedAt: now })
users.users.push({ id: randomUUID(), name: "Eduardo · Studio local", email, passwordSalt, passwordHash: scryptSync(password, passwordSalt, 64).toString("base64url"), tenantId, tenantSlug: slug, roles: ["tenant", "tenant_operator"], status: "active", createdAt: now, updatedAt: now })
await mkdir(dataDir, { recursive: true })
await save("tenants.json", tenants)
await save("auth-users.json", users)
console.log(JSON.stringify({ email, password, studio: `http://localhost:3000/tenant/${slug}/editor` }))
