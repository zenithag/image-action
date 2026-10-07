import { NextResponse, type NextRequest } from "next/server"
import { getCurrentTenantToken as getToken } from "@/lib/server/current-tenant-token"
import { findTenant } from "@/lib/server/tenants-store"
import { checkStudioRequestOrigin } from "@/lib/server/studio-surface-access"

import {
  DEFAULT_SUPERADMIN_PATH,
  getTenantHomePath,
  isSuperadmin,
} from "@/lib/auth-routing"

export default async function middleware(req: NextRequest) {
  const isSecureRequest =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https" ||
    process.env.NEXTAUTH_URL?.startsWith("https://") === true
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    secureCookie: isSecureRequest,
  })

  if (!token) {
    if (req.nextUrl.pathname.startsWith("/api/tenant/")) return NextResponse.json({ error: "Entre novamente para continuar." }, { status: 401 })
    const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`
    const loginUrl = new URL("/login", req.url)

    loginUrl.searchParams.set("callbackUrl", callbackUrl)

    return NextResponse.redirect(loginUrl)
  }

  const roles = Array.isArray(token.roles) ? token.roles.filter((role): role is string => typeof role === "string") : []
  const tenantSlug =
    typeof token.tenantSlug === "string" && token.tenantSlug
      ? token.tenantSlug
      : null
  const sessionTimeoutMinutes =
    typeof token.sessionTimeoutMinutes === "number" && Number.isFinite(token.sessionTimeoutMinutes)
      ? token.sessionTimeoutMinutes
      : null
  const issuedAt =
    typeof token.iat === "number" && Number.isFinite(token.iat)
      ? token.iat
      : null

  if (tenantSlug && sessionTimeoutMinutes && issuedAt) {
    const expiresAt = issuedAt + sessionTimeoutMinutes * 60

    if (Math.floor(Date.now() / 1000) > expiresAt) {
      const loginUrl = new URL("/login", req.url)
      loginUrl.searchParams.set("sessionExpired", "1")

      return NextResponse.redirect(loginUrl)
    }
  }

  if (req.nextUrl.pathname.startsWith("/superadmin") && !isSuperadmin(roles)) {
    return NextResponse.redirect(new URL(getTenantHomePath(tenantSlug), req.url))
  }

  if (req.nextUrl.pathname.startsWith("/api/tenant/") || req.nextUrl.pathname.startsWith("/tenant/")) {
    const api = req.nextUrl.pathname.startsWith("/api/")
    const requestedSlug = req.nextUrl.pathname.split("/")[api ? 3 : 2]
    const tenant = tenantSlug ? await findTenant(tenantSlug) : null
    if (!tenant || tenant.status !== "active" || requestedSlug !== tenantSlug || isSuperadmin(roles)) {
      if (api) return NextResponse.json({ error: "Esta conta não tem acesso ao cliente solicitado." }, { status: 403 })
      return NextResponse.redirect(new URL(isSuperadmin(roles) ? DEFAULT_SUPERADMIN_PATH : "/login?accountUnavailable=1", req.url))
    }
    if (api && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (roles.includes("tenant_viewer")) return NextResponse.json({ error: "Visualizadores têm acesso somente de leitura." }, { status: 403 })
      if (!checkStudioRequestOrigin(req.headers.get("origin"), req.headers.get("host"), req.url)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 })
    }
  }

  if (req.nextUrl.pathname.startsWith("/tenant/")) {
    if (isSuperadmin(roles)) {
      return NextResponse.redirect(new URL(DEFAULT_SUPERADMIN_PATH, req.url))
    }

    if (!tenantSlug) {
      return NextResponse.redirect(new URL("/", req.url))
    }

    const [, , requestedSlug] = req.nextUrl.pathname.split("/")
    if (requestedSlug !== tenantSlug) {
      return NextResponse.redirect(new URL(getTenantHomePath(tenantSlug), req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/tenant/:path*", "/superadmin/:path*", "/api/tenant/:path*"],
  runtime: "nodejs",
}
