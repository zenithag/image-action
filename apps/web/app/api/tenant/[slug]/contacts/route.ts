import { NextResponse } from "next/server"

import type { TenantContactInput } from "@/lib/contact-types"
import { createContact, listContacts } from "@/lib/server/contacts-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  const contacts = await listContacts(slug)

  return NextResponse.json(contacts)
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const payload = await request.json().catch(() => null) as TenantContactInput | null

  if (!payload) {
    return NextResponse.json({ error: "Payload invalido." }, { status: 400 })
  }

  try {
    const contact = await createContact(slug, payload)

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o contato.",
    }, { status: 400 })
  }
}
