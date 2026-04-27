import { NextResponse } from "next/server"

import {
  deleteStoredSuperadminUser,
  updateStoredSuperadminUser,
  validateStrongPassword,
} from "@/lib/server/auth-users-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type SuperadminUserUpdateRequest = {
  name?: unknown
  email?: unknown
  password?: unknown
  passwordConfirmation?: unknown
  status?: "active" | "disabled"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel processar o usuario."
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function PATCH(request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    const payload = await request.json() as SuperadminUserUpdateRequest
    const password = normalizePassword(payload.password)
    const passwordConfirmation = normalizePassword(payload.passwordConfirmation)

    if (password) {
      validateStrongPassword(password)

      if (password !== passwordConfirmation) {
        throw new Error("A confirmacao da senha nao confere.")
      }
    }

    const user = await updateStoredSuperadminUser(id, {
      name: payload.name,
      email: payload.email,
      password,
      status: payload.status,
    })

    if (!user) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const { id } = await context.params
    const deleted = await deleteStoredSuperadminUser(id)

    if (!deleted) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}
