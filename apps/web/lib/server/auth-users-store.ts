import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

import { readJsonStore, writeJsonStore, withJsonStoreLock } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

import { findTenant, listTenants } from "@/lib/server/tenants-store"

const scrypt = promisify(scryptCallback)
const dataFile = getRuntimeDataFile("auth-users.json")
const storeKey = "auth-users"

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
  /** Profile photo / logo as a small image data URL (kept out of the session cookie). */
  avatarUrl?: string
}

export type PublicStoredAuthUser = Omit<StoredAuthUser, "passwordHash" | "passwordSalt">

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

type CreateAuthUserInput = BootstrapUserInput & {
  status?: AuthUserStatus
}

type TenantTeamSyncMember = {
  id?: string
  name: string
  email: string
  role: "admin" | "operator" | "viewer"
  status: "active" | "invited" | "disabled"
  password?: string
}

let mutationQueue = Promise.resolve()

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase()
}

function getEmailDomain(email: string) {
  return email.includes("@") ? email.split("@").at(-1)?.toLowerCase() ?? "" : ""
}

function parseRoles(value: unknown, fallback: string[]) {
  const raw = normalizeText(value)

  if (!raw) return fallback

  return raw
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
}

function buildTenantRoles(role: TenantTeamSyncMember["role"]) {
  if (role === "admin") return ["tenant", "tenant_admin"]
  if (role === "viewer") return ["tenant", "tenant_viewer"]
  return ["tenant", "tenant_operator"]
}

function getTenantRoleFromRoles(roles: string[]): TenantTeamSyncMember["role"] {
  if (roles.includes("tenant_admin")) return "admin"
  if (roles.includes("tenant_viewer")) return "viewer"
  return "operator"
}

async function withAuthUsersMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(() => withJsonStoreLock(storeKey, dataFile, mutation), () => withJsonStoreLock(storeKey, dataFile, mutation))
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readAuthUsersData(): Promise<AuthUsersData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { users: [] },
    normalize: (parsed) => ({
      users: Array.isArray((parsed as Partial<AuthUsersData>)?.users)
        ? (parsed as AuthUsersData).users
        : [],
    }),
  })
}

async function writeAuthUsersData(data: AuthUsersData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { users: [] } }, data)
}

async function hashPassword(password: string) {
  const passwordSalt = randomBytes(16).toString("base64url")
  const derivedKey = await scrypt(password, passwordSalt, 64) as Buffer

  return {
    passwordHash: derivedKey.toString("base64url"),
    passwordSalt,
  }
}

function isTenantScopedUser(user: StoredAuthUser, tenantSlug: string) {
  return user.tenantSlug === tenantSlug && user.roles.includes("tenant")
}

function isSuperadminUser(user: StoredAuthUser) {
  return user.roles.includes("superadmin")
}

function countActiveSuperadmins(users: StoredAuthUser[]) {
  return users.filter((user) => isSuperadminUser(user) && user.status === "active").length
}

export function toPublicAuthUser(user: StoredAuthUser): PublicStoredAuthUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...publicUser } = user

  return publicUser
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
      roles: parseRoles(process.env.AUTH_BOOTSTRAP_TENANT_ROLES, ["tenant", "tenant_admin"]),
    })
  }

  return users
}

async function buildAuthUser(input: CreateAuthUserInput): Promise<StoredAuthUser> {
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
    status: "status" in input && input.status ? input.status : "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function validateStrongPassword(passwordInput: unknown) {
  const password = normalizeText(passwordInput)

  if (password.length < 12) {
    throw new Error("A senha precisa ter pelo menos 12 caracteres.")
  }

  if (!/[a-z]/.test(password)) {
    throw new Error("A senha precisa ter pelo menos uma letra minuscula.")
  }

  if (!/[A-Z]/.test(password)) {
    throw new Error("A senha precisa ter pelo menos uma letra maiuscula.")
  }

  if (!/[0-9]/.test(password)) {
    throw new Error("A senha precisa ter pelo menos um numero.")
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new Error("A senha precisa ter pelo menos um caractere especial.")
  }

  return password
}

export async function createStoredAuthUser(input: CreateAuthUserInput) {
  const email = normalizeEmail(input.email)
  const name = normalizeText(input.name)
  const password = validateStrongPassword(input.password)

  if (!name) {
    throw new Error("Nome do usuario e obrigatorio.")
  }

  if (!email) {
    throw new Error("Email do usuario e obrigatorio.")
  }

  return withAuthUsersMutation(async () => {
    const data = await readAuthUsersData()
    const emailTaken = data.users.some((user) => user.email.toLowerCase() === email)

    if (emailTaken) {
      throw new Error("Ja existe um usuario com esse email.")
    }

    const user = await buildAuthUser({
      ...input,
      name,
      email,
      password,
    })

    await writeAuthUsersData({
      users: [...data.users, user],
    })

    return user
  })
}

export async function deleteStoredAuthUserById(idInput: unknown) {
  const id = normalizeText(idInput)
  if (!id) return false
  return withAuthUsersMutation(async () => {
    const data = await readAuthUsersData()
    const user = data.users.find((item) => item.id === id)
    if (!user || isSuperadminUser(user)) return false
    await writeAuthUsersData({ users: data.users.filter((item) => item.id !== id) })
    return true
  })
}

export async function setTenantAuthUsersStatus(tenantId: string, status: AuthUserStatus) {
  return withAuthUsersMutation(async () => {
    const data = await readAuthUsersData()
    let changed = false
    const users = data.users.map((user) => {
      if (user.tenantId !== tenantId || !user.roles.includes("tenant")) return user
      changed = changed || user.status !== status
      return user.status === status ? user : { ...user, status, updatedAt: new Date().toISOString() }
    })
    if (changed) await writeAuthUsersData({ users })
    return changed
  })
}

export async function listStoredAuthUsersForTenant(tenantSlug: string) {
  const data = await ensureBootstrapUsers()

  return data.users.filter((user) => isTenantScopedUser(user, tenantSlug))
}

export async function listStoredSuperadminUsers() {
  const data = await ensureBootstrapUsers()

  return data.users
    .filter(isSuperadminUser)
    .map(toPublicAuthUser)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

export async function createStoredSuperadminUser(input: {
  name: unknown
  email: unknown
  password: unknown
  status?: AuthUserStatus
}) {
  const user = await createStoredAuthUser({
    name: normalizeText(input.name),
    email: normalizeEmail(input.email),
    password: validateStrongPassword(input.password),
    tenantId: null,
    tenantSlug: null,
    roles: ["superadmin"],
    status: input.status === "disabled" ? "disabled" : "active",
  })

  return toPublicAuthUser(user)
}

export async function updateStoredSuperadminUser(idInput: unknown, input: {
  name?: unknown
  email?: unknown
  password?: unknown
  status?: AuthUserStatus
}) {
  const id = normalizeText(idInput)

  if (!id) {
    throw new Error("Usuario nao encontrado.")
  }

  return withAuthUsersMutation(async () => {
    const data = await ensureBootstrapUsersUnlocked()
    const index = data.users.findIndex((user) => user.id === id && isSuperadminUser(user))

    if (index === -1) {
      return null
    }

    const currentUser = data.users[index]
    const name = input.name === undefined ? currentUser.name : normalizeText(input.name)
    const email = input.email === undefined ? currentUser.email : normalizeEmail(input.email)
    const status = input.status === "disabled" ? "disabled" : input.status === "active" ? "active" : currentUser.status
    const password = input.password === undefined ? "" : normalizeText(input.password)

    if (!name) {
      throw new Error("Nome do usuario e obrigatorio.")
    }

    if (!email) {
      throw new Error("Email do usuario e obrigatorio.")
    }

    if (status === "disabled" && currentUser.status === "active" && countActiveSuperadmins(data.users) <= 1) {
      throw new Error("Nao e possivel desativar o ultimo superadmin ativo.")
    }

    const emailTaken = data.users.some((user) => user.id !== currentUser.id && user.email.toLowerCase() === email)

    if (emailTaken) {
      throw new Error("Ja existe um usuario com esse email.")
    }

    let passwordFields: Partial<Pick<StoredAuthUser, "passwordHash" | "passwordSalt">> = {}

    if (password) {
      validateStrongPassword(password)
      passwordFields = await hashPassword(password)
    }

    const updatedUser: StoredAuthUser = {
      ...currentUser,
      ...passwordFields,
      name,
      email,
      tenantId: null,
      tenantSlug: null,
      roles: Array.from(new Set([...currentUser.roles, "superadmin"])),
      status,
      updatedAt: new Date().toISOString(),
    }

    const nextUsers = [...data.users]
    nextUsers[index] = updatedUser

    await writeAuthUsersData({ users: nextUsers })

    return toPublicAuthUser(updatedUser)
  })
}

export async function deleteStoredSuperadminUser(idInput: unknown) {
  const id = normalizeText(idInput)

  if (!id) {
    throw new Error("Usuario nao encontrado.")
  }

  return withAuthUsersMutation(async () => {
    const data = await ensureBootstrapUsersUnlocked()
    const user = data.users.find((item) => item.id === id && isSuperadminUser(item))

    if (!user) {
      return false
    }

    if (user.status === "active" && countActiveSuperadmins(data.users) <= 1) {
      throw new Error("Nao e possivel remover o ultimo superadmin ativo.")
    }

    await writeAuthUsersData({
      users: data.users.filter((item) => item.id !== user.id),
    })

    return true
  })
}

export async function syncStoredTenantUsers(input: {
  tenantId: string
  tenantSlug: string
  members: TenantTeamSyncMember[]
  allowedDomains?: string[]
}) {
  return withAuthUsersMutation(async () => {
    const data = await ensureBootstrapUsersUnlocked()
    const tenantUsers = data.users.filter((user) => isTenantScopedUser(user, input.tenantSlug))
    const globalByEmail = new Map(data.users.map((user) => [user.email.toLowerCase(), user] as const))
    const nextUsers = [...data.users]
    const retainedIds = new Set<string>()
    const syncedUsers: StoredAuthUser[] = []
    const allowedDomains = (input.allowedDomains ?? [])
      .map((domain) => normalizeText(domain).replace(/^@/, "").toLowerCase())
      .filter(Boolean)

    for (const rawMember of input.members) {
      const name = normalizeText(rawMember.name)
      const email = normalizeEmail(rawMember.email)
      const password = normalizeText(rawMember.password)

      if (!name || !email) {
        continue
      }

      const emailDomain = getEmailDomain(email)

      if (allowedDomains.length > 0 && !allowedDomains.includes(emailDomain)) {
        throw new Error(`O email ${email} nao pertence a um dominio permitido para este tenant.`)
      }

      const existing = tenantUsers.find((user) => user.id === rawMember.id) ?? tenantUsers.find((user) => user.email === email)
      const conflicting = globalByEmail.get(email)

      if (conflicting && conflicting.id !== existing?.id && !isTenantScopedUser(conflicting, input.tenantSlug)) {
        throw new Error(`Ja existe um usuario com o email ${email}.`)
      }

      const roles = buildTenantRoles(rawMember.role)
      const status: AuthUserStatus = rawMember.status === "disabled" ? "disabled" : "active"

      if (existing) {
        const index = nextUsers.findIndex((user) => user.id === existing.id)
        if (index === -1) continue

        let passwordFields: Partial<Pick<StoredAuthUser, "passwordHash" | "passwordSalt">> = {}
        if (password) {
          validateStrongPassword(password)
          passwordFields = await hashPassword(password)
        }

        const updatedUser: StoredAuthUser = {
          ...nextUsers[index],
          ...passwordFields,
          name,
          email,
          tenantId: input.tenantId,
          tenantSlug: input.tenantSlug,
          roles,
          status,
          updatedAt: new Date().toISOString(),
        }

        nextUsers[index] = updatedUser
        retainedIds.add(updatedUser.id)
        syncedUsers.push(updatedUser)
        globalByEmail.set(email, updatedUser)
        continue
      }

      if (!password) {
        throw new Error(`Defina uma senha inicial para ${email}.`)
      }

      validateStrongPassword(password)

      const createdUser = await buildAuthUser({
        name,
        email,
        password,
        tenantId: input.tenantId,
        tenantSlug: input.tenantSlug,
        roles,
        status,
      })

      nextUsers.push(createdUser)
      retainedIds.add(createdUser.id)
      syncedUsers.push(createdUser)
      globalByEmail.set(email, createdUser)
    }

    if (!syncedUsers.some(user => user.status === "active" && user.roles.includes("tenant_admin"))) {
      throw new Error("Mantenha pelo menos um administrador ativo na empresa.")
    }

    for (const user of tenantUsers) {
      if (retainedIds.has(user.id)) continue

      const index = nextUsers.findIndex((item) => item.id === user.id)
      if (index === -1) continue

      nextUsers[index] = {
        ...nextUsers[index],
        status: "disabled",
        updatedAt: new Date().toISOString(),
      }
    }

    await writeAuthUsersData({ users: nextUsers })

    return syncedUsers
  })
}

async function ensureBootstrapUsersUnlocked() {
  const data = await readAuthUsersData()
  const bootstrapUsers = readBootstrapUsers()
  const existingEmails = new Set(data.users.map((user) => user.email.toLowerCase()))
  const missingBootstrapUsers = bootstrapUsers.filter((user) => !existingEmails.has(user.email))

  // Repair legacy principal accounts when the company has no active administrator.
  const tenants = await listTenants()
  let repaired = false
  for (const tenant of tenants) {
    const principal = data.users.filter(user => isTenantScopedUser(user, tenant.slug))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
    if (principal && principal.status === "active" && principal.email === tenant.contactEmail && !data.users.some(user => isTenantScopedUser(user, tenant.slug) && user.status === "active" && user.roles.includes("tenant_admin"))) {
      principal.roles = ["tenant", "tenant_admin"]
      principal.updatedAt = new Date().toISOString()
      repaired = true
    }
  }
  if (missingBootstrapUsers.length === 0) {
    if (repaired) await writeAuthUsersData(data)
    return data
  }

  const createdUsers = await Promise.all(missingBootstrapUsers.map(buildAuthUser))
  const nextData = {
    users: [...data.users, ...createdUsers],
  }

  await writeAuthUsersData(nextData)

  return nextData
}

async function ensureBootstrapUsers() {
  return withAuthUsersMutation(async () => ensureBootstrapUsersUnlocked())
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

  if (user.tenantSlug && (await findTenant(user.tenantSlug))?.status !== "active") return null

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

const MAX_AVATAR_LENGTH = 400_000

export async function getStoredAuthUserById(idInput: unknown) {
  const id = normalizeText(idInput)
  if (!id) return null

  const data = await ensureBootstrapUsers()
  const user = data.users.find((item) => item.id === id)

  return user ? toPublicAuthUser(user) : null
}

async function mutateOwnUser(
  idInput: unknown,
  mutate: (user: StoredAuthUser, users: StoredAuthUser[]) => Promise<Partial<StoredAuthUser>>,
) {
  const id = normalizeText(idInput)

  return withAuthUsersMutation(async () => {
    const data = await ensureBootstrapUsersUnlocked()
    const index = data.users.findIndex((user) => user.id === id)

    if (index === -1) return null

    const changes = await mutate(data.users[index], data.users)
    const updated: StoredAuthUser = { ...data.users[index], ...changes, updatedAt: new Date().toISOString() }
    const nextUsers = [...data.users]
    nextUsers[index] = updated

    await writeAuthUsersData({ users: nextUsers })

    return toPublicAuthUser(updated)
  })
}

export async function updateOwnProfile(idInput: unknown, input: { name?: unknown; avatarUrl?: unknown }) {
  return mutateOwnUser(idInput, async (user) => {
    const changes: Partial<StoredAuthUser> = {}

    if (input.name !== undefined) {
      const name = normalizeText(input.name)
      if (!name) throw new Error("O nome é obrigatório.")
      changes.name = name.slice(0, 120)
    }

    if (input.avatarUrl !== undefined) {
      const avatar = normalizeText(input.avatarUrl)
      if (avatar && !/^data:image\/(png|jpeg|webp);base64,/.test(avatar)) {
        throw new Error("Use uma imagem PNG, JPG ou WebP.")
      }
      if (avatar.length > MAX_AVATAR_LENGTH) throw new Error("A imagem é grande demais.")
      changes.avatarUrl = avatar || undefined
    }

    void user
    return changes
  })
}

export async function changeOwnEmail(idInput: unknown, input: { newEmail: unknown; currentPassword: unknown }) {
  const email = normalizeEmail(input.newEmail)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.")

  return mutateOwnUser(idInput, async (user, users) => {
    if (!(await verifyPassword(normalizeText(input.currentPassword), user))) {
      throw new Error("Senha atual incorreta.")
    }

    if (users.some((item) => item.id !== user.id && item.email.toLowerCase() === email)) {
      throw new Error("Já existe um usuário com esse e-mail.")
    }

    return { email }
  })
}

export async function changeOwnPassword(idInput: unknown, input: { currentPassword: unknown; newPassword: unknown }) {
  const newPassword = validateStrongPassword(input.newPassword)

  return mutateOwnUser(idInput, async (user) => {
    if (!(await verifyPassword(normalizeText(input.currentPassword), user))) {
      throw new Error("Senha atual incorreta.")
    }

    return hashPassword(newPassword)
  })
}
