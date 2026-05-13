import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { Pool } from "pg"

type JsonStoreOptions<T> = {
  key: string
  filePath: string
  fallback: T
  normalize?: (value: unknown) => T
}

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

  const result = await activePool.query<{ data: unknown }>(
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

  await activePool.query(
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

  const result = await activePool.query("delete from app_documents where key = $1", [options.key])
  return (result.rowCount ?? 0) > 0
}
