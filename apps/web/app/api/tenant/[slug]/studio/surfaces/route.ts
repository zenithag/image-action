import { NextResponse } from "next/server"

// Temporarily disabled: no request can initiate paid recognition from stale clients.
export async function POST() {
  return NextResponse.json({ error: "O reconhecimento e a seleção automática de superfícies foram desativados. Descreva o local de aplicação em texto." }, { status: 410 })
}
