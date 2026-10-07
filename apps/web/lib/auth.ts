import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"

import { authenticateStoredUser, getStoredAuthUserById } from "@/lib/server/auth-users-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"

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
      const user = await authenticateStoredUser(credentials?.email, credentials?.password)

      if (!user?.tenantSlug) {
        return user
      }

      const settings = await getTenantSettings(user.tenantSlug)

      return {
        ...user,
        sessionTimeoutMinutes: settings.security.sessionTimeoutMinutes,
      }
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
    async jwt({ token, account, profile, user, trigger }) {
      if (token.sub && !user) {
        const stored = await getStoredAuthUserById(token.sub)

        if (stored) {
          token.name = stored.name
          token.email = stored.email
          token.roles = stored.status === "active" ? stored.roles : []
        }
      }

      if (account) token.authProvider = account.provider

      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.tenantId = (user as { tenantId?: string | null }).tenantId ?? null
        token.tenantSlug = (user as { tenantSlug?: string | null }).tenantSlug ?? null
        token.roles = (user as { roles?: string[] }).roles ?? []
        token.sessionTimeoutMinutes = (user as { sessionTimeoutMinutes?: number }).sessionTimeoutMinutes
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
          sessionTimeoutMinutes: typeof token.sessionTimeoutMinutes === "number" ? token.sessionTimeoutMinutes : null,
        },
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
