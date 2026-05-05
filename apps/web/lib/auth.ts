import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

type DevUser = {
  id: string
  name: string
  email: string
  password: string
  tenantId: string | null
  tenantSlug: string | null
  roles: string[]
}

function parseRoles(value: string) {
  return value
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean)
}

const devUsers: DevUser[] = [
  {
    id: "dev-superadmin",
    name: process.env.DEV_LOGIN_NAME || "Wesley Cardoso",
    email: process.env.DEV_LOGIN_EMAIL || "cardoso.tads@gmail.com",
    password: process.env.DEV_LOGIN_PASSWORD || "Admin123!",
    tenantId: null,
    tenantSlug: null,
    roles: parseRoles(process.env.DEV_LOGIN_ROLES || "superadmin"),
  },
  {
    id: "dev-tenant-decor-labs",
    name: process.env.DEV_TENANT_LOGIN_NAME || "Operador Decor Labs",
    email: process.env.DEV_TENANT_LOGIN_EMAIL || "operador@decorlabs.local",
    password: process.env.DEV_TENANT_LOGIN_PASSWORD || "Tenant123!",
    tenantId: process.env.DEV_TENANT_ID || "decor-labs",
    tenantSlug: process.env.DEV_TENANT_SLUG || "decor-labs",
    roles: parseRoles(process.env.DEV_TENANT_LOGIN_ROLES || "tenant"),
  },
]

const hasZitadelConfig = Boolean(
  process.env.ZITADEL_ISSUER_URL &&
    process.env.ZITADEL_CLIENT_ID &&
    process.env.ZITADEL_CLIENT_SECRET
)

const providers: NonNullable<NextAuthConfig["providers"]> = [
  Credentials({
    id: "credentials",
    name: "Email e senha",
    credentials: {
      email: { label: "E-mail", type: "email" },
      password: { label: "Senha", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || "").trim().toLowerCase()
      const password = String(credentials?.password || "")
      const matchedUser = devUsers.find(
        (user) => user.email.toLowerCase() === email && user.password === password
      )

      return matchedUser || null
    },
  }),
]

if (hasZitadelConfig) {
  providers.push({
    id: "zitadel",
    name: "Zitadel",
    type: "oidc",
    issuer: process.env.ZITADEL_ISSUER_URL,
    clientId: process.env.ZITADEL_CLIENT_ID,
    clientSecret: process.env.ZITADEL_CLIENT_SECRET,
    authorization: {
      params: {
        scope: "openid profile email urn:zitadel:iam:org:project:id:zitadel:aud",
      },
    },
  })
}

export const authConfig: NextAuthConfig = {
  providers,
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null
        token.tenantSlug = (user as { tenantSlug?: string | null }).tenantSlug ?? null
        token.roles = (user as { roles?: string[] }).roles ?? []
      }

      if (account?.provider === "zitadel" && profile) {
        token.accessToken = account.access_token
        const orgId = (profile as Record<string, unknown>)["urn:zitadel:iam:org:id"]
        if (typeof orgId === "string") {
          token.tenantId = orgId
        }
        const projectId = process.env.ZITADEL_PROJECT_ID || ""
        const rolesKey = `urn:zitadel:iam:org:project:${projectId}:roles`
        const projectRoles = (profile as Record<string, unknown>)[rolesKey]
        if (projectRoles && typeof projectRoles === "object") {
          token.roles = Object.keys(projectRoles as Record<string, unknown>)
        } else {
          token.roles = []
        }
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        user: {
          ...session.user,
          id: token.sub || "",
          tenantId: (token.tenantId as string) || null,
          tenantSlug: (token.tenantSlug as string) || null,
          roles: (token.roles as string[]) || [],
        },
      }
    },
  },
  pages: {
    signIn: "/",
  },
  trustHost: true,
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
