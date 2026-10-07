import { getToken, type JWT } from "next-auth/jwt"
import { getStoredAuthUserById } from "./auth-users-store"

// Refresh local roles/status instead of trusting an old signed session after a team edit.
export async function getCurrentTenantToken(options: Parameters<typeof getToken>[0]): Promise<JWT | null> {
  const token = await getToken(options)
  if (!token || typeof token === "string") return null
  if (!token.sub) return null
  const user = await getStoredAuthUserById(token.sub)
  if (!user) return token.authProvider === "zitadel" || token.accessToken ? token : token.tenantSlug ? null : token // OIDC users without a local binding are managed by the identity provider.
  if (user.status !== "active") return null
  return { ...token, roles: user.roles, tenantSlug: user.tenantSlug, tenantId: user.tenantId, name: user.name, email: user.email }
}
