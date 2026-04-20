import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

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
    const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`
    const loginUrl = new URL("/", req.url)

    loginUrl.searchParams.set("callbackUrl", callbackUrl)

    return NextResponse.redirect(loginUrl)
  }

  const roles = Array.isArray(token.roles) ? token.roles.filter((role): role is string => typeof role === "string") : []
  const tenantSlug =
    typeof token.tenantSlug === "string" && token.tenantSlug
      ? token.tenantSlug
      : null

  if (req.nextUrl.pathname.startsWith("/superadmin") && !isSuperadmin(roles)) {
    return NextResponse.redirect(new URL(getTenantHomePath(tenantSlug), req.url))
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
  matcher: ["/tenant/:path*", "/superadmin/:path*"],
}
