import { NextResponse } from "next/server"

import { processAppJobQueue } from "@/lib/server/app-job-worker"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getExpectedWorkerToken() {
  return process.env.APP_JOB_WORKER_TOKEN?.trim() || process.env.NEXTAUTH_SECRET?.trim() || ""
}

function isAuthorized(request: Request) {
  const expectedToken = getExpectedWorkerToken()

  if (!expectedToken) {
    return process.env.NODE_ENV !== "production"
  }

  return request.headers.get("x-app-job-worker-token") === expectedToken
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await processAppJobQueue()

  return NextResponse.json({
    ok: true,
    processedAt: new Date().toISOString(),
  })
}
