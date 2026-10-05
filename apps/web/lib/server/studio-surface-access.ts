type Claims = { sub?: unknown; tenantSlug?: unknown; tenantId?: unknown; roles?: unknown; iat?: unknown; exp?: unknown; sessionTimeoutMinutes?: unknown }
export function checkStudioSurfaceAccess(token: Claims | null, slug: string, tenant: { id: string; slug: string; status: string } | null, nowSeconds = Date.now() / 1000): 401 | 403 | null {
  if (!token || typeof token.sub !== "string" || !token.sub || typeof token.exp !== "number" || token.exp <= nowSeconds) return 401
  if (typeof token.sessionTimeoutMinutes === "number" && token.sessionTimeoutMinutes > 0 && (typeof token.iat !== "number" || token.iat + token.sessionTimeoutMinutes * 60 <= nowSeconds)) return 401
  // Legacy local accounts can use the slug as tenantId; both signed bindings must agree.
  if (!tenant || tenant.status !== "active" || tenant.slug !== slug || token.tenantSlug !== slug || (token.tenantId !== tenant.id && token.tenantId !== slug) || !Array.isArray(token.roles) || token.roles.includes("superadmin")) return 403
  return null
}

// NextURL normalizes loopback IPs to localhost. Host retains the transport authority;
// do not accept both aliases or use an arbitrary forwarded host as a CSRF bypass.
export function checkStudioRequestOrigin(origin: string | null, host: string | null, requestUrl: string): boolean {
  if (!origin) return true
  try {
    const transport = new URL(requestUrl)
    if (host && /[\s/@?#\\]/.test(host)) return false
    const expected = host ? new URL(`${transport.protocol}//${host}`) : transport
    const supplied = new URL(origin)
    if (!["http:", "https:"].includes(supplied.protocol) || supplied.username || supplied.password || supplied.pathname !== "/" || supplied.search || supplied.hash) return false
    return supplied.origin === expected.origin
  } catch { return false }
}
