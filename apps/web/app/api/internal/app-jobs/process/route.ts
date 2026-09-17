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
    console.error("APP_JOB_WORKER_TOKEN or NEXTAUTH_SECRET not configured")
    return false
  }

  const token = request.headers.get("x-app-job-worker-token")
  if (!token) {
    return false
  }

  const { timingSafeEqual } = require("crypto")
  const a = Buffer.from(token)
  const b = Buffer.from(expectedToken)
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const processedJobs = await processAppJobQueue()

  return NextResponse.json({
    ok: true,
    processedJobs,
    processedAt: new Date().toISOString(),
  })
}
