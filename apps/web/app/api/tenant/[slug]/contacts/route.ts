import { NextResponse } from "next/server"
import { z } from "zod"

import type { TenantContactInput } from "@/lib/contact-types"
import { createContact, listContacts } from "@/lib/server/contacts-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

const TenantContactInputSchema = z.object({
  externalContactId: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const MAX_BODY_SIZE = 50_000

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
  if (!slug || typeof slug !== "string" || slug.length > 100) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
  }
  const contacts = await listContacts(slug)

  return NextResponse.json(contacts)
}

export async function POST(request: Request, context: RouteContext) {
  const { slug } = await context.params
  if (!slug || typeof slug !== "string" || slug.length > 100) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 })
  }

  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  let rawPayload: unknown
  try {
    rawPayload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }

  const parsed = TenantContactInputSchema.safeParse(rawPayload)
  if (!parsed.success) {
    return NextResponse.json({
      error: "Payload invalido.",
      details: parsed.error.flatten().fieldErrors,
    }, { status: 400 })
  }

  try {
    const contact = await createContact(slug, parsed.data as TenantContactInput)

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel criar o contato.",
    }, { status: 400 })
  }
}
