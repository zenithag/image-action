type SessionUserLike = {
  roles?: string[] | null
  tenantSlug?: string | null
}

export const DEFAULT_SUPERADMIN_PATH = "/superadmin"
export const POST_LOGIN_PATH = "/auth/post-login"

export function isSuperadmin(roles?: string[] | null) {
  return (roles || []).includes("superadmin")
}

export function getTenantHomePath(tenantSlug?: string | null) {
  if (!tenantSlug) {
    return "/"
  }

  return `/tenant/${tenantSlug}`
}

export function getDefaultDashboardPath(user?: SessionUserLike | null) {
  if (!user) {
    return POST_LOGIN_PATH
  }

  if (isSuperadmin(user.roles)) {
    return DEFAULT_SUPERADMIN_PATH
  }

  if (!user.tenantSlug) {
    return "/"
  }

  return getTenantHomePath(user.tenantSlug)
}

function getCallbackPathname(callbackUrl: string) {
  try {
    return new URL(callbackUrl, "https://comofica.local").pathname
  } catch {
    return "/"
  }
}

function isAuthCallbackPath(pathname: string) {
  return pathname === "/" || pathname === "/login" || pathname.startsWith("/auth/")
}

export function getSafeCallbackUrl(
  callbackUrl: string | undefined,
  user?: SessionUserLike | null
) {
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return getDefaultDashboardPath(user)
  }

  const pathname = getCallbackPathname(callbackUrl)
  if (isAuthCallbackPath(pathname)) {
    return getDefaultDashboardPath(user)
  }

  if (!user) {
    return callbackUrl
  }

  if (pathname.startsWith("/superadmin")) {
    return isSuperadmin(user.roles) ? callbackUrl : getDefaultDashboardPath(user)
  }

  if (pathname.startsWith("/tenant/")) {
    const [, , requestedSlug] = pathname.split("/")
    return user.tenantSlug && requestedSlug === user.tenantSlug
      ? callbackUrl
      : getDefaultDashboardPath(user)
  }

  return callbackUrl
}
