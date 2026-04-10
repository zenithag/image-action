type SessionUserLike = {
  roles?: string[] | null
  tenantSlug?: string | null
}

export const DEFAULT_SUPERADMIN_PATH = "/superadmin"

export function isSuperadmin(roles?: string[] | null) {
  return (roles || []).includes("superadmin")
}

export function getTenantHomePath(tenantSlug?: string | null) {
  if (!tenantSlug) {
    return DEFAULT_SUPERADMIN_PATH
  }

  return `/tenant/${tenantSlug}`
}

export function getDefaultDashboardPath(user?: SessionUserLike | null) {
  if (!user) {
    return DEFAULT_SUPERADMIN_PATH
  }

  if (isSuperadmin(user.roles)) {
    return DEFAULT_SUPERADMIN_PATH
  }

  return getTenantHomePath(user.tenantSlug)
}

export function getSafeCallbackUrl(
  callbackUrl: string | undefined,
  user?: SessionUserLike | null
) {
  if (!callbackUrl || !callbackUrl.startsWith("/")) {
    return getDefaultDashboardPath(user)
  }

  return callbackUrl
}
