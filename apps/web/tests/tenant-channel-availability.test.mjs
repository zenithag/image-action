import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
async function load(path, resolve = () => { throw new Error('Unexpected dependency') }) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  runInNewContext(code, { exports, require: resolve, process: { env: {} }, URL })
  return exports
}
const instance = { tenantSlug: 'teste', channel: 'whatsapp', instanceToken: 'private-test-value', status: 'connected', connected: true, loggedIn: true, updatedAt: '2026-10-06T10:00:00Z' }

test('only a configured tenant instance with agreeing connection fields is connected; snapshots do not leak credentials', async () => {
  const { summarizeWhatsappAvailability: summarize } = await load('../lib/tenant-channel-availability.ts')
  assert.equal(summarize([{ ...instance, tenantSlug: 'other' }], 'teste').connection, 'not-configured')
  assert.equal(summarize([{ ...instance, instanceToken: '' }], 'teste').configured, false)
  for (const change of [{ connected: false }, { loggedIn: false }, { status: 'disconnected' }]) assert.equal(summarize([{ ...instance, ...change }], 'teste').connection, 'disconnected')
  assert.equal(summarize([{ ...instance, status: 'connecting' }], 'teste').connection, 'connecting')
  assert.equal(summarize([{ ...instance, status: 'error' }], 'teste').connection, 'error')
  const result = summarize([instance], 'teste')
  assert.equal(result.connection, 'connected')
  assert.equal(result.recordedAt, instance.updatedAt)
  assert.equal(JSON.stringify(result).includes(instance.instanceToken), false)
  assert.deepEqual(Object.keys(result).sort(), ['configured', 'connection', 'recordedAt'])
})

test('availability endpoint rejects anonymous, expired and cross-tenant access before reading instances, and returns only sanitized status', async () => {
  const summarize = await load('../lib/tenant-channel-availability.ts')
  const access = await load('../lib/server/studio-surface-access.ts')
  const claims = { sub: 'user', tenantSlug: 'teste', tenantId: 'tenant-id', roles: ['tenant_operator'], exp: Date.now() / 1000 + 3600 }
  let token = null
  let reads = 0
  const route = await load('../app/api/tenant/[slug]/channels/availability/route.ts', name => {
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => ({ body, status: opts?.status ?? 200, headers: opts?.headers }) } }
    if (name === 'next-auth/jwt') return { getToken: async () => token }
    if (name.includes('tenant-channel-availability')) return summarize
    if (name.includes('studio-surface-access')) return access
    if (name.includes('tenants-store')) return { findTenant: async slug => ({ id: 'tenant-id', slug, status: 'active' }) }
    if (name.includes('tenant-channel-instances-store')) return { readTenantInstances: async () => { reads++; return [instance, { ...instance, tenantSlug: 'other' }] } }
    throw new Error(`Unexpected dependency ${name}`)
  })
  const request = { nextUrl: new URL('http://127.0.0.1:3000'), headers: new Headers() }
  const context = { params: Promise.resolve({ slug: 'teste' }) }
  assert.equal((await route.GET(request, context)).status, 401)
  token = { ...claims, exp: 1 }
  assert.equal((await route.GET(request, context)).status, 401)
  token = { ...claims, tenantSlug: 'other' }
  assert.equal((await route.GET(request, context)).status, 403)
  assert.equal(reads, 0)
  token = claims
  const result = await route.GET(request, context)
  assert.equal(result.status, 200)
  assert.equal(result.headers['Cache-Control'], 'private, no-store')
  assert.equal(result.body.whatsapp.connection, 'connected')
  assert.equal(JSON.stringify(result.body).includes(instance.instanceToken), false)
  assert.equal(reads, 1)
})
