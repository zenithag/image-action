import { NextResponse } from "next/server"
import { z } from "zod"

import type { TenantContactInput } from "@/lib/contact-types"
import { createContact, listContacts } from "@/lib/server/contacts-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

// Mirrors TenantContactInput (lib/contact-types.ts), which is what the console form and
// contacts-store use. `name` is the only required field; the form sends "" for empty optionals.
const TenantContactInputSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do contato.").max(255),
  phone: z.string().max(50).optional(),
  email: z.union([z.literal(""), z.string().email("E-mail invalido.").max(255)]).optional(),
  company: z.string().max(255).optional(),
  status: z.enum(["active", "archived"]).optional(),
  tags: z.union([z.array(z.string().max(80)).max(50), z.string().max(2000)]).optional(),
  notes: z.string().max(5000).optional(),
  externalContactId: z.string().max(255).optional(),
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
    const fieldErrors = parsed.error.flatten().fieldErrors
    const firstMessage = Object.values(fieldErrors).flat().find(Boolean)

    return NextResponse.json({
      error: firstMessage ?? "Payload invalido.",
      details: fieldErrors,
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
