import { NextResponse } from "next/server"

import {
  type ChannelKind,
  type ProviderKind,
  type StoredProvider,
  readProviders,
  sanitizeProvider,
  writeProviders,
} from "@/lib/server/channel-providers-store"

type ProviderPayload = {
  name?: unknown
  kind?: unknown
  provider?: unknown
  baseUrl?: unknown
  adminToken?: unknown
  contractedCapacity?: unknown
  reservedCapacity?: unknown
  notes?: unknown
}

export const runtime = "nodejs"

const channelKinds = new Set<ChannelKind>(["whatsapp", "instagram", "telegram"])
const providerKinds = new Set<ProviderKind>(["uazapi", "meta", "telegram-bot-api"])

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

export async function GET() {
  const providers = await readProviders()
  return NextResponse.json(providers.map(sanitizeProvider))
}

export async function POST(request: Request) {
  const payload = await request.json() as ProviderPayload
  const name = asTrimmedString(payload.name)
  const kind = asTrimmedString(payload.kind) as ChannelKind
  const provider = asTrimmedString(payload.provider) as ProviderKind
  const baseUrl = asTrimmedString(payload.baseUrl)
  const adminToken = asTrimmedString(payload.adminToken)
  const notes = asTrimmedString(payload.notes)

  if (!name) {
    return NextResponse.json({ error: "Nome interno e obrigatorio." }, { status: 400 })
  }

  if (!channelKinds.has(kind)) {
    return NextResponse.json({ error: "Canal invalido." }, { status: 400 })
  }

  if (!providerKinds.has(provider)) {
    return NextResponse.json({ error: "Provider tecnico invalido." }, { status: 400 })
  }

  if (provider === "uazapi" && (!baseUrl || !adminToken)) {
    return NextResponse.json({ error: "Base URL e admin token sao obrigatorios para UAZAPI." }, { status: 400 })
  }

  const contractedCapacity = provider === "uazapi" ? asNumber(payload.contractedCapacity, 0) : undefined
  const reservedCapacity = provider === "uazapi" ? asNumber(payload.reservedCapacity, 0) : undefined

  if (provider === "uazapi" && (!contractedCapacity || contractedCapacity < 1)) {
    return NextResponse.json({ error: "Capacidade contratada deve ser maior que zero." }, { status: 400 })
  }

  const storedProvider: StoredProvider = {
    id: crypto.randomUUID(),
    name,
    kind,
    provider,
    status: "active",
    baseUrl: baseUrl || undefined,
    adminToken: provider === "uazapi" ? adminToken : undefined,
    contractedCapacity,
    reservedCapacity,
    usedCapacity: 0,
    health: "ok",
    notes: notes || (
      provider === "uazapi"
        ? "Provider UAZAPI cadastrado manualmente. Capacidade controlada pelo Superadmin."
        : "Conector global cadastrado. A autorizacao final acontece no tenant."
    ),
    createdAt: new Date().toISOString(),
  }

  const providers = await readProviders()
  await writeProviders([storedProvider, ...providers])

  return NextResponse.json(sanitizeProvider(storedProvider), { status: 201 })
}
