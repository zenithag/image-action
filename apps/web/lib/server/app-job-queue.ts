import { Pool } from "pg"

export type AppJobType = "process_inbound_message" | "process_composition_queue"

export type ProcessInboundMessagePayload = {
  tenantSlug: string
  channelInstanceId: string
  conversationId: string
  messageId: string
}

export type ProcessCompositionQueuePayload = {
  tenantSlug: string
}

export type AppJobPayloadByType = {
  process_inbound_message: ProcessInboundMessagePayload
  process_composition_queue: ProcessCompositionQueuePayload
}

export type AppJob<TType extends AppJobType = AppJobType> = {
  id: string
  type: TType
  payload: AppJobPayloadByType[TType]
  attempts: number
  maxAttempts: number
  runAt: string
  lastError?: string
}

type AppJobStatus = "queued" | "processing" | "done" | "failed"

type AppJobRow = {
  id: string
  type: AppJobType
  payload: unknown
  attempts: number
  max_attempts: number
  run_at: Date | string
  last_error: string | null
}

type EnqueueOptions = {
  dedupeKey?: string
  maxAttempts?: number
  runAt?: Date
}

let pool: Pool | null = null
let tableReady: Promise<void> | null = null
let processingLoop: Promise<number | void> | null = null

const memoryJobs: Array<AppJob & { status: AppJobStatus; dedupeKey?: string }> = []

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || ""
}

function getPool() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    return null
  }

  pool ??= new Pool({
    connectionString: databaseUrl,
    max: 5,
  })

  return pool
}

async function ensureQueueTable() {
  const activePool = getPool()

  if (!activePool) {
    return null
  }

  tableReady ??= activePool.query(`
    create table if not exists app_job_queue (
      id uuid primary key,
      type text not null,
      dedupe_key text,
      payload jsonb not null,
      status text not null default 'queued',
      attempts integer not null default 0,
      max_attempts integer not null default 5,
      run_at timestamptz not null default now(),
      locked_at timestamptz,
      locked_by text,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists app_job_queue_ready_idx
      on app_job_queue (status, run_at, created_at);

    create unique index if not exists app_job_queue_active_dedupe_idx
      on app_job_queue (dedupe_key)
      where dedupe_key is not null and status in ('queued', 'processing');
  `).then(() => undefined)

  await tableReady

  return activePool
}

function normalizeJob(row: AppJobRow): AppJob {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload as AppJobPayloadByType[AppJobType],
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAt: new Date(row.run_at).toISOString(),
    lastError: row.last_error ?? undefined,
  }
}

function getRetryDelaySeconds(attempts: number) {
  return Math.min(300, 5 * 2 ** Math.max(0, attempts - 1))
}

function scheduleDeferredProcessing(delaySeconds: number) {
  const timeout = setTimeout(() => {
    scheduleAppJobProcessing()
  }, Math.max(1, delaySeconds) * 1000)

  timeout.unref?.()
}

export async function enqueueAppJob<TType extends AppJobType>(
  type: TType,
  payload: AppJobPayloadByType[TType],
  options: EnqueueOptions = {}
) {
  const activePool = await ensureQueueTable()
  const now = new Date()
  const runAt = options.runAt ?? now
  const maxAttempts = options.maxAttempts ?? 5

  if (!activePool) {
    const existing = options.dedupeKey
      ? memoryJobs.find((job) => job.dedupeKey === options.dedupeKey && ["queued", "processing"].includes(job.status))
      : null

    if (existing) {
      return existing
    }

    const job = {
      id: crypto.randomUUID(),
      type,
      payload,
      attempts: 0,
      maxAttempts,
      runAt: runAt.toISOString(),
      status: "queued" as const,
      dedupeKey: options.dedupeKey,
    }

    memoryJobs.push(job)
    return job
  }

  const result = await activePool.query<AppJobRow>(
    `
      insert into app_job_queue (id, type, dedupe_key, payload, status, max_attempts, run_at)
      values ($1, $2, $3, $4::jsonb, 'queued', $5, $6)
      on conflict do nothing
      returning id, type, payload, attempts, max_attempts, run_at, last_error
    `,
    [crypto.randomUUID(), type, options.dedupeKey ?? null, JSON.stringify(payload), maxAttempts, runAt]
  )

  if (result.rows[0]) {
    return normalizeJob(result.rows[0]) as AppJob<TType>
  }

  if (!options.dedupeKey) {
    throw new Error("Nao foi possivel enfileirar o job.")
  }

  const existing = await activePool.query<AppJobRow>(
    `
      select id, type, payload, attempts, max_attempts, run_at, last_error
      from app_job_queue
      where dedupe_key = $1 and status in ('queued', 'processing')
      order by created_at desc
      limit 1
    `,
    [options.dedupeKey]
  )

  if (!existing.rows[0]) {
    throw new Error("Nao foi possivel recuperar o job enfileirado.")
  }

  return normalizeJob(existing.rows[0]) as AppJob<TType>
}

export async function claimNextAppJob() {
  const activePool = await ensureQueueTable()

  if (!activePool) {
    const now = Date.now()
    const job = memoryJobs
      .filter((item) => item.status === "queued" && new Date(item.runAt).getTime() <= now)
      .sort((left, right) => new Date(left.runAt).getTime() - new Date(right.runAt).getTime())[0]

    if (!job) {
      return null
    }

    job.status = "processing"
    job.attempts += 1
    return job
  }

  const result = await activePool.query<AppJobRow>(
    `
      with next_job as (
        select id
        from app_job_queue
        where
          (status = 'queued' and run_at <= now())
          or (status = 'processing' and locked_at < now() - interval '10 minutes')
        order by run_at asc, created_at asc
        for update skip locked
        limit 1
      )
      update app_job_queue
      set
        status = 'processing',
        attempts = attempts + 1,
        locked_at = now(),
        locked_by = $1,
        updated_at = now()
      from next_job
      where app_job_queue.id = next_job.id
      returning app_job_queue.id,
        app_job_queue.type,
        app_job_queue.payload,
        app_job_queue.attempts,
        app_job_queue.max_attempts,
        app_job_queue.run_at,
        app_job_queue.last_error
    `,
    [`web-${process.pid}`]
  )

  return result.rows[0] ? normalizeJob(result.rows[0]) : null
}

export async function completeAppJob(jobId: string) {
  const activePool = await ensureQueueTable()

  if (!activePool) {
    const job = memoryJobs.find((item) => item.id === jobId)

    if (job) {
      job.status = "done"
    }

    return
  }

  await activePool.query(
    `
      update app_job_queue
      set status = 'done',
        locked_at = null,
        locked_by = null,
        updated_at = now()
      where id = $1
    `,
    [jobId]
  )
}

export async function failAppJob(job: AppJob, error: unknown) {
  const activePool = await ensureQueueTable()
  const lastError = error instanceof Error ? error.message : String(error)
  const shouldRetry = job.attempts < job.maxAttempts
  const delaySeconds = shouldRetry ? getRetryDelaySeconds(job.attempts) : 0

  if (!activePool) {
    const memoryJob = memoryJobs.find((item) => item.id === job.id)

    if (memoryJob) {
      memoryJob.status = shouldRetry ? "queued" : "failed"
      memoryJob.lastError = lastError
      memoryJob.runAt = new Date(Date.now() + delaySeconds * 1000).toISOString()
    }

    if (shouldRetry) {
      scheduleDeferredProcessing(delaySeconds)
    }

    return
  }

  await activePool.query(
    `
      update app_job_queue
      set status = $2,
        run_at = case when $2 = 'queued' then now() + ($3::integer * interval '1 second') else run_at end,
        locked_at = null,
        locked_by = null,
        last_error = $4,
        updated_at = now()
      where id = $1
    `,
    [job.id, shouldRetry ? "queued" : "failed", delaySeconds, lastError]
  )

  if (shouldRetry) {
    scheduleDeferredProcessing(delaySeconds)
  }
}

export async function hasReadyAppJobs() {
  const activePool = await ensureQueueTable()

  if (!activePool) {
    const now = Date.now()
    return memoryJobs.some((job) => job.status === "queued" && new Date(job.runAt).getTime() <= now)
  }

  const result = await activePool.query<{ found: number }>(
    `
      select 1 as found
      from app_job_queue
      where status = 'queued' and run_at <= now()
      limit 1
    `
  )

  return Boolean(result.rows[0])
}

export async function enqueueProcessInboundMessage(payload: ProcessInboundMessagePayload) {
  return enqueueAppJob("process_inbound_message", payload, {
    dedupeKey: `inbound:${payload.tenantSlug}:${payload.messageId}`,
    maxAttempts: 5,
  })
}

export async function enqueueProcessCompositionQueue(tenantSlug: string) {
  return enqueueAppJob("process_composition_queue", { tenantSlug }, {
    maxAttempts: 3,
  })
}

export function scheduleAppJobProcessing() {
  if (processingLoop) {
    return
  }

  processingLoop = import("@/lib/server/app-job-worker")
    .then(({ processAppJobQueue }) => processAppJobQueue())
    .catch((error: unknown) => {
      console.error("App job queue processing failed", error)
    })
    .finally(() => {
      processingLoop = null
      void hasReadyAppJobs()
        .then((ready) => {
          if (ready) {
            scheduleAppJobProcessing()
          }
        })
        .catch((error: unknown) => {
          console.error("App job queue readiness check failed", error)
        })
    })
}
