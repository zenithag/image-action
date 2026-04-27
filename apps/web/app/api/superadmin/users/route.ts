import { NextResponse } from "next/server"

import {
  createStoredSuperadminUser,
  listStoredSuperadminUsers,
  validateStrongPassword,
} from "@/lib/server/auth-users-store"
import { requireSuperadmin } from "@/lib/server/superadmin-api-auth"

export const runtime = "nodejs"

type SuperadminUserCreateRequest = {
  name?: unknown
  email?: unknown
  password?: unknown
  passwordConfirmation?: unknown
  status?: "active" | "disabled"
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nao foi possivel processar o usuario."
}

function normalizeConfirmation(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET() {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  const users = await listStoredSuperadminUsers()

  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const unauthorized = await requireSuperadmin()
  if (unauthorized) return unauthorized

  try {
    const payload = await request.json() as SuperadminUserCreateRequest
    const password = validateStrongPassword(payload.password)
    const passwordConfirmation = normalizeConfirmation(payload.passwordConfirmation)

    if (password !== passwordConfirmation) {
      throw new Error("A confirmacao da senha nao confere.")
    }

    const user = await createStoredSuperadminUser({
      name: payload.name,
      email: payload.email,
      password,
      status: payload.status === "disabled" ? "disabled" : "active",
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 })
  }
}
