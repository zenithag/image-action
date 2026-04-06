import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: "zitadel",
      name: "Zitadel",
      type: "oidc",
      issuer: process.env.ZITADEL_ISSUER_URL || "http://localhost:8080",
      clientId: process.env.ZITADEL_CLIENT_ID || "",
      clientSecret: process.env.ZITADEL_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid profile email urn:zitadel:iam:org:project:id:zitadel:aud",
        },
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
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
          roles: (token.roles as string[]) || [],
        },
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
