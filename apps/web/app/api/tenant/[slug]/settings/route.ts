import { NextResponse, type NextRequest } from "next/server"

import { getToken } from "next-auth/jwt"
import { findTenant } from "@/lib/server/tenants-store"
import { checkStudioSurfaceAccess, checkStudioRequestOrigin } from "@/lib/server/studio-surface-access"

import type { TenantSettingsInput } from "@/lib/tenant-settings-types"
import { getTenantSettings, updateTenantSettings } from "@/lib/server/tenant-settings-store"
import { getTenantCatalogAccess } from "@/lib/server/tenant-catalog-access"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

async function settingsAccess(request: NextRequest, slug: string, write = false) {
  const secureCookie = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" || process.env.NEXTAUTH_URL?.startsWith("https://") === true
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, secureCookie })
  const denied = checkStudioSurfaceAccess(token, slug, token ? await findTenant(slug) : null)
  if (denied) return NextResponse.json({ error: "Acesso não autorizado às configurações." }, { status: denied })
  if (write && (!Array.isArray(token!.roles) || !token!.roles.includes("tenant_admin") || !checkStudioRequestOrigin(request.headers.get("origin"), request.headers.get("host"), request.url))) return NextResponse.json({ error: "Somente administradores podem alterar as configurações." }, { status: 403 })
  return null
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const denied = await settingsAccess(request, slug)
  if (denied) return denied
  const settings = await getTenantSettings(slug)

  const catalogAccess = await getTenantCatalogAccess(slug)
  return NextResponse.json({ ...settings, studio: { ...settings.studio, catalogEnabled: catalogAccess.enabled }, catalogAccess })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params
  const denied = await settingsAccess(request, slug, true)
  if (denied) return denied
  const payload = await request.json().catch(() => null) as TenantSettingsInput | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  if (payload.team?.members?.some(member => member.monthlyGenerationLimit !== undefined && (!Number.isSafeInteger(member.monthlyGenerationLimit) || member.monthlyGenerationLimit < 0))) return NextResponse.json({ error: "A cota mensal deve ser um número inteiro não negativo ou ficar vazia." }, { status: 400 })

  try {
    const catalogAccess = await getTenantCatalogAccess(slug)
    if (!catalogAccess.included && payload.studio?.catalogEnabled === true) return NextResponse.json({ error: "O plano desta empresa não inclui catálogo." }, { status: 403 })
    // Entitlements are derived from the server's plan configuration, never from the payload.
    if (!catalogAccess.included) payload.studio = { ...payload.studio, catalogEnabled: false }
    const settings = await updateTenantSettings(slug, payload)
    const nextCatalogAccess = await getTenantCatalogAccess(slug)
    return NextResponse.json({ ...settings, studio: { ...settings.studio, catalogEnabled: nextCatalogAccess.enabled }, catalogAccess: nextCatalogAccess })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.",
    }, { status: 400 })
  }
}
