import { NextResponse } from "next/server"

import { readAiGuardrails } from "@/lib/server/ai-guardrails-store"

export const runtime = "nodejs"

export async function GET() {
  const guardrails = await readAiGuardrails()
  return NextResponse.json(guardrails)
}
