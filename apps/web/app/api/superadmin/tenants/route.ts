import { NextResponse } from "next/server"

import type { TenantInput } from "@/lib/tenant-types"
import { createStoredAuthUser, validateStrongPassword } from "@/lib/server/auth-users-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"
import { createTenant, deleteTenant, listTenants } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel processar o tenant."
}

type TenantCreateRequest = TenantInput & {
  initialUserPassword?: string
  initialUserPasswordConfirmation?: string
}

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const tenants = await listTenants()
  return NextResponse.json(tenants)
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json() as TenantCreateRequest
    const initialPassword = validateStrongPassword(payload.initialUserPassword)
    const passwordConfirmation = typeof payload.initialUserPasswordConfirmation === "string"
      ? payload.initialUserPasswordConfirmation.trim()
      : ""
    const contactEmail = typeof payload.contactEmail === "string" ? payload.contactEmail.trim().toLowerCase() : ""

    if (!contactEmail) {
      throw new Error("Email principal e obrigatorio para criar o acesso inicial do tenant.")
    }

    if (initialPassword !== passwordConfirmation) {
      throw new Error("A confirmacao da senha nao confere.")
    }

    const tenant = await createTenant(payload)

    try {
      await createStoredAuthUser({
        name: payload.contactName?.trim() || tenant.name,
        email: contactEmail,
        password: initialPassword,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        roles: ["tenant"],
      })
    } catch (error) {
      await deleteTenant(tenant.id)
      throw error
    }

    return NextResponse.json(tenant, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}
