import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { summarizeWhatsappAvailability } from "@/lib/tenant-channel-availability"
import { checkStudioSurfaceAccess } from "@/lib/server/studio-surface-access"
import { findTenant } from "@/lib/server/tenants-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"

export const runtime = "nodejs"

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  if (!slug || slug.length > 100) return NextResponse.json({ error: "Tenant inválido." }, { status: 400 })
  const secureCookie = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https" || process.env.NEXTAUTH_URL?.startsWith("https://") === true
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET, secureCookie })
  const access = checkStudioSurfaceAccess(token, slug, token ? await findTenant(slug) : null)
  if (access) return NextResponse.json({ error: access === 401 ? "Entre novamente para consultar os canais." : "Você não tem acesso a este tenant." }, { status: access })
  const whatsapp = summarizeWhatsappAvailability(await readTenantInstances(), slug)
  return NextResponse.json({ whatsapp }, { headers: { "Cache-Control": "private, no-store" } })
}
