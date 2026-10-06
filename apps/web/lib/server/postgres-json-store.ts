import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { Pool, type PoolClient } from "pg"
import { AsyncLocalStorage } from "node:async_hooks"

type JsonStoreOptions<T> = {
  key: string
  filePath: string
  fallback: T
  normalize?: (value: unknown) => T
}

const lockedClient = new AsyncLocalStorage<PoolClient>()
let pool: Pool | null = null
let tableReady: Promise<void> | null = null

function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() || ""
}

function getPool() {
  const databaseUrl = getDatabaseUrl()

  if (!databaseUrl) {
    return null
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
    })
  }

  return pool
}

async function ensureTable() {
  const activePool = getPool()

  if (!activePool) {
    return null
  }

  tableReady ??= activePool.query(`
    create table if not exists app_documents (
      key text primary key,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `).then(() => undefined)

  await tableReady

  return activePool
}

function normalizeValue<T>(value: unknown, options: JsonStoreOptions<T>) {
  return options.normalize ? options.normalize(value) : value as T
}

async function readJsonFile<T>(options: JsonStoreOptions<T>) {
  try {
    const contents = await readFile(options.filePath, "utf8")
    const parsed = JSON.parse(contents) as unknown

    return {
      found: true,
      data: normalizeValue(parsed, options),
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        found: false,
        data: options.fallback,
      }
    }

    throw error
  }
}

async function writeJsonFile<T>(options: JsonStoreOptions<T>, data: T) {
  await mkdir(path.dirname(options.filePath), { recursive: true })
  const temporaryFile = `${options.filePath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`

  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8")
  await rename(temporaryFile, options.filePath)
}

export async function readJsonStore<T>(options: JsonStoreOptions<T>) {
  const activePool = await ensureTable()

  if (!activePool) {
    return (await readJsonFile(options)).data
  }

  const result = await (lockedClient.getStore() ?? activePool).query<{ data: unknown }>(
    "select data from app_documents where key = $1",
    [options.key]
  )

  if (result.rowCount && result.rows[0]) {
    return normalizeValue(result.rows[0].data, options)
  }

  const fileData = await readJsonFile(options)

  if (fileData.found) {
    await writeJsonStore(options, fileData.data)
  }

  return fileData.data
}

export async function writeJsonStore<T>(options: JsonStoreOptions<T>, data: T) {
  const activePool = await ensureTable()

  if (!activePool) {
    await writeJsonFile(options, data)
    return
  }

  await (lockedClient.getStore() ?? activePool).query(
    `
      insert into app_documents (key, data, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (key)
      do update set data = excluded.data, updated_at = now()
    `,
    [options.key, JSON.stringify(data)]
  )
}

export async function deleteJsonStore<T>(options: JsonStoreOptions<T>) {
  const activePool = await ensureTable()

  if (!activePool) {
    try {
      await unlink(options.filePath)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
    return false
  }

  const result = await (lockedClient.getStore() ?? activePool).query("delete from app_documents where key = $1", [options.key])
  return (result.rowCount ?? 0) > 0
}

// Serialize document read/check/write across web and worker processes in PostgreSQL.
export async function withJsonStoreLock<T>(key: string, filePath: string, mutation: () => Promise<T>): Promise<T> {
  const activePool = await ensureTable()
  if (!activePool) {
    // Never break another process's lock: a crashed local process requires explicit recovery.
    await mkdir(path.dirname(filePath), { recursive: true })
    const lockPath = `${filePath}.lock`
    const deadline = Date.now() + 30_000
    while (true) {
      try {
        const file = await open(lockPath, "wx")
        await file.close()
        break
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
        if (Date.now() >= deadline) throw new Error("O armazenamento está ocupado. Tente novamente ou verifique o processo local.")
        await new Promise(resolve => setTimeout(resolve, 25))
      }
    }
    try { return await mutation() } finally { await unlink(lockPath) }
  }
  const client = await activePool.connect()
  try {
    await client.query("begin")
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [key])
    const result = await lockedClient.run(client, mutation)
    await client.query("commit")
    return result
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally { client.release() }
}
