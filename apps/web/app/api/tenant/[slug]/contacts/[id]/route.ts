import { NextResponse } from "next/server"

import type { TenantContactInput } from "@/lib/contact-types"
import { deleteContact, updateContact } from "@/lib/server/contacts-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string; id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const payload = await request.json().catch(() => null) as TenantContactInput | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  try {
    const contact = await updateContact(slug, decodeURIComponent(id), payload)

    if (!contact) {
      return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 })
    }

    return NextResponse.json(contact)
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel atualizar o contato.",
    }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { slug, id } = await context.params
  const deleted = await deleteContact(slug, decodeURIComponent(id))

  if (!deleted) {
    return NextResponse.json({ error: "Contato nao encontrado." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
