import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { findTenant } from "./tenants-store"
import { getTenantSettings } from "./tenant-settings-store"
import { getChannelPlanLimitMap } from "./channel-plan-limits-store"
import { checkStudioRequestOrigin, checkStudioSurfaceAccess } from "./studio-surface-access"

export async function getTenantCatalogAccess(slug: string) {
  const tenant = await findTenant(slug)
  if (!tenant || tenant.status !== "active") return { included: false, enabled: false }
  const [plans, settings] = await Promise.all([getChannelPlanLimitMap(), getTenantSettings(slug)])
  const included = plans[tenant.planCode]?.catalogIncluded === true
  return { included, enabled: included && settings.studio.catalogEnabled }
}

export async function requireTenantCatalogAccess(request: NextRequest, slug: string, write = false) {
  const secureCookie = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" || process.env.NEXTAUTH_URL?.startsWith("https://") === true
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, secureCookie })
  const denied = checkStudioSurfaceAccess(token, slug, token ? await findTenant(slug) : null)
  if (denied) return NextResponse.json({ error: "Acesso não autorizado ao catálogo." }, { status: denied })
  if (write && !checkStudioRequestOrigin(request.headers.get("origin"), request.headers.get("host"), request.url)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 })
  if (!(await getTenantCatalogAccess(slug)).enabled) return NextResponse.json({ error: "O catálogo não está disponível neste plano ou está desativado." }, { status: 403 })
  return null
}
