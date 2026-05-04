import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))

for (const envFile of [join(scriptDir, "..", ".env.local"), join(scriptDir, "..", ".env")]) {
  if (!existsSync(envFile)) {
    continue
  }

  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue
    }

    const index = trimmed.indexOf("=")
    const key = trimmed.slice(0, index).trim()
    const rawValue = trimmed.slice(index + 1).trim()
    const value = rawValue.replace(/^["']|["']$/g, "")

    process.env[key] ??= value
  }
}

const workerUrl = (
  process.env.APP_JOB_WORKER_URL ||
  process.env.APP_JOB_PROCESS_URL ||
  "http://127.0.0.1:3000/api/internal/app-jobs/process"
).trim()
const workerToken = (
  process.env.APP_JOB_WORKER_TOKEN ||
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  ""
).trim()
const idleIntervalMs = Math.max(250, Number(process.env.APP_JOB_WORKER_INTERVAL_MS || process.env.APP_JOB_WORKER_INTERVAL_SECONDS || 2) * 1000)
const busyIntervalMs = Math.max(100, Number(process.env.APP_JOB_WORKER_BUSY_INTERVAL_MS || 250))
const requestTimeoutMs = Math.max(1000, Number(process.env.APP_JOB_WORKER_TIMEOUT_MS || 120_000))

let stopped = false

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForEndpoint() {
  while (!stopped) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), Math.min(5000, requestTimeoutMs))
      const response = await fetch(workerUrl, {
        method: "POST",
        headers: workerToken ? { "x-app-job-worker-token": workerToken } : undefined,
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (response.ok || response.status === 401) {
        return
      }
    } catch {
      // The web process may still be booting.
    }

    await sleep(1000)
  }
}

async function processOnce() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: workerToken ? { "x-app-job-worker-token": workerToken } : undefined,
      signal: controller.signal,
    })
    const text = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`)
    }

    try {
      const payload = JSON.parse(text)
      return Number(payload.processedJobs || 0)
    } catch {
      return 0
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  console.log(`[app-job-worker] polling ${workerUrl}`)
  await waitForEndpoint()

  while (!stopped) {
    try {
      const processedJobs = await processOnce()

      if (processedJobs > 0) {
        console.log(`[app-job-worker] processed ${processedJobs} job(s)`)
        await sleep(busyIntervalMs)
      } else {
        await sleep(idleIntervalMs)
      }
    } catch (error) {
      console.error("[app-job-worker] processing failed", error)
      await sleep(idleIntervalMs)
    }
  }
}

process.on("SIGINT", () => {
  stopped = true
})

process.on("SIGTERM", () => {
  stopped = true
})

main().catch((error) => {
  console.error("[app-job-worker] fatal error", error)
  process.exitCode = 1
})
