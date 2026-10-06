import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import * as fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
async function load(file, resolve) {
  const code = ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const exports = {}
  runInNewContext(code, { exports, require: resolve, process: { env: {}, pid: process.pid }, crypto: globalThis.crypto, structuredClone, URL, setTimeout })
  return exports
}
test('monthly quota reserves atomically across independent stores, keeps dedupe, tenant isolation, retry and purge usage', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'quota-isolated-'))
  try {
    const filePath = path.join(directory, 'jobs.json')
    const json = await load('../lib/server/postgres-json-store.ts', name => name === 'node:fs/promises' ? fs : require(name))
    let limit = 2
    const resolve = name => name.includes('postgres-json-store') ? json : name.includes('tenant-settings-store') ? { getTenantSettings: async () => ({ team: { members: [{ id: 'a', role: 'operator', status: 'active', monthlyGenerationLimit: limit }] } }) } : { getRuntimeDataFile: () => filePath }
    const first = await load('../lib/server/composition-jobs-store.ts', resolve)
    const second = await load('../lib/server/composition-jobs-store.ts', resolve)
    const input = id => ({ source: 'operator', sourceMessageId: id, operator: { id: 'a', name: 'Ana' }, conversationId: 'studio', channelInstanceId: 'upload', contactName: 'Cliente' })
    const attempts = await Promise.allSettled([first.createCompositionJob('t', input('one')), second.createCompositionJob('t', input('two')), first.createCompositionJob('t', input('three'))])
    assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 2)
    assert.equal(attempts.find(item => item.status === 'rejected').reason.name, 'OperatorQuotaExceededError')
    const duplicate = await second.createCompositionJob('t', input('one'))
    assert.equal(duplicate.created, false)
    await first.updateCompositionJob('t', duplicate.job.id, { status: 'failed' })
    await first.retryCompositionJob('t', duplicate.job.id)
    await first.archiveCompositionJob('t', duplicate.job.id)
    await assert.rejects(first.createCompositionJob('t', input('new')), /Limite mensal/)
    assert.equal((await first.createCompositionJob('other', input('new'))).created, true)
    await first.purgeTenantCompositionJobs('t')
    await assert.rejects(first.createCompositionJob('t', input('after-purge')), /Limite mensal/)
    limit = undefined
    assert.equal((await first.createCompositionJob('t', input('unlimited'))).created, true)
    limit = 0
    await assert.rejects(first.createCompositionJob('third', input('zero')), /Limite mensal/)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test('PostgreSQL lock encloses document writes and rolls back errors', async () => {
  const calls = []
  const client = { query: async (sql) => { calls.push(sql); return { rows: [{ data: { jobs: [] } }], rowCount: 1 } }, release: () => calls.push('release') }
  class Pool { async query(sql) { calls.push(sql); return {} } async connect() { return client } }
  const source = (await readFile(new URL('../lib/server/postgres-json-store.ts', import.meta.url), 'utf8'))
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const exports = {}
  runInNewContext(code, { exports, require: name => name === 'pg' ? { Pool } : require(name), process: { env: { DATABASE_URL: 'synthetic-mocked-only' } }, crypto: globalThis.crypto })
  await exports.withJsonStoreLock('composition-jobs', 'unused', async () => {
    await exports.readJsonStore({ key: 'composition-jobs', filePath: 'unused', fallback: {} })
    await exports.writeJsonStore({ key: 'composition-jobs', filePath: 'unused', fallback: {} }, { jobs: [] })
  })
  assert.ok(calls.includes('begin'))
  assert.ok(calls.includes('select pg_advisory_xact_lock(hashtextextended($1, 0))'))
  assert.ok(calls.includes('commit'))
  await assert.rejects(exports.withJsonStoreLock('composition-jobs', 'unused', async () => { throw Error('synthetic failure') }), /synthetic failure/)
  assert.equal(calls.at(-2), 'rollback')
  assert.equal(calls.at(-1), 'release')
})
test('local lock serializes competing operating-system processes without touching runtime data', async () => {
  const { writeFile } = await import('node:fs/promises')
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const directory = await mkdtemp(path.join(tmpdir(), 'quota-processes-'))
  try {
    const helper = path.join(directory, 'json-store.cjs')
    const source = await readFile(new URL('../lib/server/postgres-json-store.ts', import.meta.url), 'utf8')
    await writeFile(helper, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText)
    const counter = path.join(directory, 'counter.json')
    await writeFile(counter, '0')
    const script = `const fs=require('node:fs/promises'); const {withJsonStoreLock}=require(${JSON.stringify(helper)}); withJsonStoreLock('isolated',${JSON.stringify(counter)},async()=>{const n=Number(await fs.readFile(${JSON.stringify(counter)},'utf8'));await new Promise(r=>setTimeout(r,30));await fs.writeFile(${JSON.stringify(counter)},String(n+1))}).catch(e=>{console.error(e);process.exitCode=1})`
    await Promise.all(Array.from({ length: 3 }, () => promisify(execFile)(process.execPath, ['-e', script], { env: { NODE_PATH: path.resolve(new URL('../node_modules', import.meta.url).pathname), DATABASE_URL: '' } })))
    assert.equal(await readFile(counter, 'utf8'), '3')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test('team quota survives auth hydration, saving and unrelated setting edits', async () => {
  let data = { settings: [] }
  const user = { id: 'signed-id', name: 'Ana', email: 'ana@example.invalid', roles: ['tenant_operator'], status: 'active', lastLoginAt: '2026-10-01' }
  const settings = await load('../lib/server/tenant-settings-store.ts', name => {
    if (name.includes('tenant-settings-types')) return { DEFAULT_STUDIO_SETTINGS: { catalogEnabled: false, environmentTypes: ['Sala'], propertyContexts: ['Casa'] } }
    if (name.includes('watermark-layout')) return { normalizeWatermarkPercent: (value, fallback) => typeof value === 'number' ? value : fallback }
    if (name.includes('auth-users-store')) return { listStoredAuthUsersForTenant: async () => [user], syncStoredTenantUsers: async () => [user] }
    if (name.includes('postgres-json-store')) return { readJsonStore: async () => structuredClone(data), writeJsonStore: async (_, value) => { data = structuredClone(value) } }
    if (name.includes('runtime-paths')) return { getRuntimeDataFile: () => 'memory-only' }
    if (name.includes('tenants-store')) return { findTenant: async slug => ({ id: 'tenant-id', slug, name: 'Teste' }) }
    throw Error(name)
  })
  await settings.updateTenantSettings('test', { team: { members: [{ id: 'temporary-ui-id', name: 'Ana', email: user.email, role: 'operator', status: 'active', monthlyGenerationLimit: 7 }] } })
  assert.equal((await settings.getTenantSettings('test')).team.members[0].monthlyGenerationLimit, 7)
  assert.equal((await settings.getTenantSettings('test')).team.members[0].id, 'signed-id')
  await settings.updateTenantSettings('test', { general: { description: 'Outra alteração' } })
  assert.equal((await settings.getTenantSettings('test')).team.members[0].monthlyGenerationLimit, 7)
  await settings.updateTenantSettings('test', { team: { members: [{ ...user, role: 'operator', monthlyGenerationLimit: undefined }] } })
  assert.equal((await settings.getTenantSettings('test')).team.members[0].monthlyGenerationLimit, undefined)
})
test('operator cannot remove own quota: settings mutations require tenant admin and same origin', async () => {
  const access = await load('../lib/server/studio-surface-access.ts', () => { throw Error('unexpected') })
  let token = { sub: 'a', tenantSlug: 't', tenantId: 'id-t', roles: ['tenant_operator'], exp: Date.now() / 1000 + 600 }
  let writes = 0
  const route = await load('../app/api/tenant/[slug]/settings/route.ts', name => {
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => ({ body, status: opts?.status ?? 200 }) } }
    if (name.includes('next-auth/jwt')) return { getToken: async () => token }
    if (name.includes('studio-surface-access')) return access
    if (name.includes('tenants-store')) return { findTenant: async slug => ({ id: 'id-t', slug, status: 'active' }) }
    if (name.includes('tenant-catalog-access')) return { getTenantCatalogAccess: async () => ({ included: true, enabled: true }) }
    if (name.includes('tenant-settings-store')) return { getTenantSettings: async () => ({ studio: { catalogEnabled: false } }), updateTenantSettings: async (_, value) => { writes++; return value } }
    throw Error(name)
  })
  const url = 'http://127.0.0.1:3000/api/tenant/t/settings'
  const request = payload => ({ url, nextUrl: new URL(url), headers: new Headers({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }), json: async () => payload })
  const context = { params: Promise.resolve({ slug: 't' }) }
  const payload = { team: { members: [{ id: 'a', monthlyGenerationLimit: 0 }] } }
  assert.equal((await route.PATCH(request(payload), context)).status, 403)
  token = { ...token, roles: ['tenant_admin'] }
  assert.equal((await route.PATCH(request(payload), context)).status, 200)
  assert.equal((await route.PATCH(request({ team: { members: [{ monthlyGenerationLimit: -1 }] } }), context)).status, 400)
  const crossOrigin = request(payload); crossOrigin.headers.set('origin', 'https://other.invalid')
  assert.equal((await route.PATCH(crossOrigin, context)).status, 403)
  token = { ...token, tenantSlug: 'other' }
  assert.equal((await route.PATCH(request(payload), context)).status, 403)
  token = null
  assert.equal((await route.GET(request(payload), context)).status, 401)
  assert.equal(writes, 1)
})
