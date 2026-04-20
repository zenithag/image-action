import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

const scrypt = promisify(scryptCallback)
const dataFile = getRuntimeDataFile("auth-users.json")

export type AuthUserStatus = "active" | "disabled"

export type StoredAuthUser = {
  id: string
  name: string
  email: string
  passwordHash: string
  passwordSalt: string
  tenantId: string | null
  tenantSlug: string | null
  roles: string[]
  status: AuthUserStatus
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

type AuthUsersData = {
  users: StoredAuthUser[]
}

type BootstrapUserInput = {
  name: string
  email: string
  password: string
  tenantId: string | null
  tenantSlug: string | null
  roles: string[]
}

let mutationQueue = Promise.resolve()

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function parseRoles(value: unknown, fallback: string[]) {
  const raw = normalizeText(value)

  if (!raw) return fallback

  return raw
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
}

async function withAuthUsersMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readAuthUsersData(): Promise<AuthUsersData> {
  try {
    const contents = await readFile(dataFile, "utf8")
    const parsed = JSON.parse(contents) as Partial<AuthUsersData>

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { users: [] }
    }

    throw error
  }
}

async function writeAuthUsersData(data: AuthUsersData) {
  await mkdir(path.dirname(dataFile), { recursive: true })
  const temporaryFile = `${dataFile}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`

  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  await rename(temporaryFile, dataFile)
}

async function hashPassword(password: string) {
  const passwordSalt = randomBytes(16).toString("base64url")
  const derivedKey = await scrypt(password, passwordSalt, 64) as Buffer

  return {
    passwordHash: derivedKey.toString("base64url"),
    passwordSalt,
  }
}

async function verifyPassword(password: string, user: StoredAuthUser) {
  const derivedKey = await scrypt(password, user.passwordSalt, 64) as Buffer
  const storedHash = Buffer.from(user.passwordHash, "base64url")

  if (storedHash.length !== derivedKey.length) {
    return false
  }

  return timingSafeEqual(storedHash, derivedKey)
}

function readBootstrapUsers(): BootstrapUserInput[] {
  const superadminEmail = normalizeEmail(process.env.AUTH_BOOTSTRAP_SUPERADMIN_EMAIL)
  const superadminPassword = normalizeText(process.env.AUTH_BOOTSTRAP_SUPERADMIN_PASSWORD)
  const tenantEmail = normalizeEmail(process.env.AUTH_BOOTSTRAP_TENANT_EMAIL)
  const tenantPassword = normalizeText(process.env.AUTH_BOOTSTRAP_TENANT_PASSWORD)
  const users: BootstrapUserInput[] = []

  if (superadminEmail && superadminPassword) {
    users.push({
      name: normalizeText(process.env.AUTH_BOOTSTRAP_SUPERADMIN_NAME) || "Superadmin",
      email: superadminEmail,
      password: superadminPassword,
      tenantId: null,
      tenantSlug: null,
      roles: parseRoles(process.env.AUTH_BOOTSTRAP_SUPERADMIN_ROLES, ["superadmin"]),
    })
  }

  if (tenantEmail && tenantPassword) {
    const tenantSlug = normalizeText(process.env.AUTH_BOOTSTRAP_TENANT_SLUG) || "decor-labs"

    users.push({
      name: normalizeText(process.env.AUTH_BOOTSTRAP_TENANT_NAME) || "Operador",
      email: tenantEmail,
      password: tenantPassword,
      tenantId: normalizeText(process.env.AUTH_BOOTSTRAP_TENANT_ID) || tenantSlug,
      tenantSlug,
      roles: parseRoles(process.env.AUTH_BOOTSTRAP_TENANT_ROLES, ["tenant"]),
    })
  }

  return users
}

async function buildAuthUser(input: BootstrapUserInput): Promise<StoredAuthUser> {
  const timestamp = new Date().toISOString()
  const password = await hashPassword(input.password)

  return {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    ...password,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    roles: input.roles,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

async function ensureBootstrapUsers() {
  return withAuthUsersMutation(async () => {
    const data = await readAuthUsersData()
    const bootstrapUsers = readBootstrapUsers()
    const existingEmails = new Set(data.users.map((user) => user.email.toLowerCase()))
    const missingBootstrapUsers = bootstrapUsers.filter((user) => !existingEmails.has(user.email))

    if (missingBootstrapUsers.length === 0) {
      return data
    }

    const createdUsers = await Promise.all(missingBootstrapUsers.map(buildAuthUser))
    const nextData = {
      users: [...data.users, ...createdUsers],
    }

    await writeAuthUsersData(nextData)

    return nextData
  })
}

export async function authenticateStoredUser(emailInput: unknown, passwordInput: unknown) {
  const email = normalizeEmail(emailInput)
  const password = normalizeText(passwordInput)

  if (!email || !password) {
    return null
  }

  const data = await ensureBootstrapUsers()
  const user = data.users.find((item) => item.email.toLowerCase() === email && item.status === "active")

  if (!user || !(await verifyPassword(password, user))) {
    return null
  }

  await withAuthUsersMutation(async () => {
    const latestData = await readAuthUsersData()

    await writeAuthUsersData({
      users: latestData.users.map((item) =>
        item.id === user.id
          ? { ...item, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : item
      ),
    })
  })

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    roles: user.roles,
  }
}
