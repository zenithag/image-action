import { randomBytes, scrypt as scryptCallback } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { Pool } from "pg"

const scrypt = promisify(scryptCallback)
const storeKey = "auth-users"

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase()
}

function parseRoles(value, fallback) {
  const raw = normalizeText(value)

  if (!raw) return fallback

  return raw
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
}

function readSeedInput() {
  const email = normalizeEmail(process.env.SEED_SUPERADMIN_EMAIL || process.env.AUTH_BOOTSTRAP_SUPERADMIN_EMAIL)
  const password = normalizeText(process.env.SEED_SUPERADMIN_PASSWORD || process.env.AUTH_BOOTSTRAP_SUPERADMIN_PASSWORD)

  if (!email) {
    throw new Error("Configure SEED_SUPERADMIN_EMAIL ou AUTH_BOOTSTRAP_SUPERADMIN_EMAIL.")
  }

  if (!password) {
    throw new Error("Configure SEED_SUPERADMIN_PASSWORD ou AUTH_BOOTSTRAP_SUPERADMIN_PASSWORD.")
  }

  return {
    name: normalizeText(process.env.SEED_SUPERADMIN_NAME || process.env.AUTH_BOOTSTRAP_SUPERADMIN_NAME) || "Superadmin",
    email,
    password,
    roles: parseRoles(process.env.SEED_SUPERADMIN_ROLES || process.env.AUTH_BOOTSTRAP_SUPERADMIN_ROLES, ["superadmin"]),
    overwrite: normalizeText(process.env.SEED_SUPERADMIN_OVERWRITE).toLowerCase() === "true",
  }
}

function getDataFile() {
  const dataDir = normalizeText(process.env.VISUALFLOW_DATA_DIR) || path.join(process.cwd(), ".local")

  return path.join(dataDir, "auth-users.json")
}

async function ensureTable(pool) {
  await pool.query(`
    create table if not exists app_documents (
      key text primary key,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
}

function normalizeAuthUsersData(value) {
  return {
    users: Array.isArray(value?.users) ? value.users : [],
  }
}

async function readLocalData() {
  try {
    const contents = await readFile(getDataFile(), "utf8")
    return normalizeAuthUsersData(JSON.parse(contents))
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { users: [] }
    }

    throw error
  }
}

async function writeLocalData(data) {
  const filePath = getDataFile()
  await mkdir(path.dirname(filePath), { recursive: true })

  const temporaryFile = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  await rename(temporaryFile, filePath)
}

async function readData(pool) {
  if (!pool) {
    return readLocalData()
  }

  await ensureTable(pool)
  const result = await pool.query("select data from app_documents where key = $1", [storeKey])

  if (result.rows[0]) {
    return normalizeAuthUsersData(result.rows[0].data)
  }

  const localData = await readLocalData()

  if (localData.users.length > 0) {
    await writeData(pool, localData)
  }

  return localData
}

async function writeData(pool, data) {
  if (!pool) {
    await writeLocalData(data)
    return
  }

  await ensureTable(pool)
  await pool.query(
    `
      insert into app_documents (key, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key)
      do update set data = excluded.data, updated_at = now()
    `,
    [storeKey, JSON.stringify(data)]
  )
}

async function hashPassword(password) {
  const passwordSalt = randomBytes(16).toString("base64url")
  const derivedKey = await scrypt(password, passwordSalt, 64)

  return {
    passwordHash: Buffer.from(derivedKey).toString("base64url"),
    passwordSalt,
  }
}

async function buildSuperadmin(input) {
  const timestamp = new Date().toISOString()
  const password = await hashPassword(input.password)

  return {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    ...password,
    tenantId: null,
    tenantSlug: null,
    roles: input.roles.includes("superadmin") ? input.roles : [...input.roles, "superadmin"],
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function main() {
  const input = readSeedInput()
  const databaseUrl = normalizeText(process.env.DATABASE_URL)
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 1 }) : null

  try {
    const data = await readData(pool)
    const existingIndex = data.users.findIndex((user) => normalizeEmail(user.email) === input.email)

    if (existingIndex >= 0 && !input.overwrite) {
      const existingUser = data.users[existingIndex]
      const roles = new Set(Array.isArray(existingUser.roles) ? existingUser.roles : [])
      roles.add("superadmin")

      data.users[existingIndex] = {
        ...existingUser,
        roles: [...roles],
        status: "active",
        tenantId: null,
        tenantSlug: null,
        updatedAt: new Date().toISOString(),
      }

      await writeData(pool, data)
      console.log(`Superadmin ja existia e foi garantido como ativo: ${input.email}`)
      return
    }

    const user = await buildSuperadmin(input)

    if (existingIndex >= 0) {
      data.users[existingIndex] = {
        ...user,
        id: data.users[existingIndex].id || user.id,
        createdAt: data.users[existingIndex].createdAt || user.createdAt,
      }
      await writeData(pool, data)
      console.log(`Superadmin atualizado: ${input.email}`)
      return
    }

    await writeData(pool, {
      users: [...data.users, user],
    })

    console.log(`Superadmin criado: ${input.email}`)
  } finally {
    await pool?.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
