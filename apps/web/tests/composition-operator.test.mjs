import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
async function load(path, resolve) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  runInNewContext(code, { exports, require: resolve, process: { env: {} }, crypto: globalThis.crypto, URL })
  return exports
}

test('signed operator survives storage and deduplication; Analytics counts by identity and period without inventing historical authors', async () => {
  let state = { jobs: [] }
  const store = await load('../lib/server/composition-jobs-store.ts', name => name.includes('postgres-json-store')
    ? { withJsonStoreLock: async (_, __, fn) => fn(), readJsonStore: async () => structuredClone(state), writeJsonStore: async (_, value) => { state = structuredClone(value) } }
    : name.includes("tenant-settings-store") ? { getTenantSettings: async () => ({ team: { members: [] } }) } : { getRuntimeDataFile: () => 'test-memory-only' })
  const access = await load('../lib/server/studio-surface-access.ts', () => { throw new Error('Unexpected dependency') })
  const claims = { sub: 'operator-a', name: 'Ana', tenantSlug: 'test', tenantId: 'tenant-test', roles: ['tenant_operator'], exp: Date.now() / 1000 + 3600 }
  let token = claims
  let enqueueCalls = 0
  const resolve = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, opts) => ({ body, status: opts?.status || 200 }) } }
    if (name === 'zod') return require('zod')
    if (name === '@/lib/server/current-tenant-token') return { getCurrentTenantToken: async () => token }
    if (name.includes('studio-surface-access')) return access
    if (name.includes('tenants-store')) return { findTenant: async slug => ({ id: 'tenant-test', slug, status: 'active' }) }
    if (name.includes('composition-jobs-store')) return store
    if (name.includes('app-job-queue')) return { enqueueProcessCompositionQueue: async () => { enqueueCalls++ }, scheduleAppJobProcessing() {} }
    if (name.includes('composition-base-snapshots')) return { ensureCompositionBaseSnapshot: async job => job }
    if (name.includes('image-normalization')) return { normalizeDataImageUrlForUpload: async url => url }
    if (name.includes('token-ledger-store')) return { canTenantCreateComposition: async () => ({ allowed: true }) }
    if (name.includes('tenant-catalog-access')) return { getTenantCatalogAccess: async () => ({ included: false, enabled: false }) }
    if (name.includes('studio-v1')) return { matchesStudioMaterial: () => true }
    if (name.includes('tenant-settings-store')) return { getTenantSettings: async () => ({ studio: { catalogEnabled: false } }) }
    if (name.includes('inbox-store')) return { listInboxConversations: async () => [], listInboxMessages: async () => [] }
    if (name.includes('catalog-store')) return { listCatalogItems: async () => [] }
    if (name.includes('contacts-store')) return { listContacts: async () => [] }
    if (name.includes('tenant-channel-instances-store')) return { readTenantInstances: async () => [] }
    throw new Error(`Unexpected dependency ${name}`)
  }
  const route = await load('../app/api/tenant/[slug]/compositions/jobs/route.ts', resolve)
  const analytics = await load('../app/api/tenant/[slug]/analytics/route.ts', resolve)
  const context = { params: Promise.resolve({ slug: 'test' }) }
  const url = 'http://127.0.0.1:3000/api/tenant/test/compositions/jobs'
  const request = payload => ({ url, nextUrl: new URL(url), headers: new Headers({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }), json: async () => payload })
  const input = { studioVersion: 'v1', conversationId: 'studio:test', channelInstanceId: 'studio-upload', contactName: 'Cliente', baseImageUrl: 'test-base', prompt: 'Mobiliar', source: 'ai', sourceMessageId: 'request-a', operator: { id: 'forged', name: 'Nome enviado pelo cliente' } }
  const created = await route.POST(request(input), context)
  assert.equal(created.status, 201)
  assert.deepEqual(JSON.parse(JSON.stringify(created.body.job.operator)), { id: 'operator-a', name: 'Ana' })
  assert.equal(created.body.job.source, 'operator')
  token = { ...claims, sub: 'operator-b', name: 'Bruno' }
  const deduped = await route.POST(request(input), context)
  assert.equal(deduped.status, 200)
  assert.equal(deduped.body.job.operator.name, 'Ana')
  const preset = await route.POST(request({ ...input, sourceMessageId: 'request-b', purpose: 'studio-preset' }), context)
  assert.equal(preset.body.job.operator.name, 'Bruno')
  await store.updateCompositionJob('test', created.body.job.id, { status: 'done' })
  await store.createCompositionJob('test', { ...input, sourceMessageId: 'legacy', source: 'operator', operator: undefined })
  const ai = await store.createCompositionJob('test', { ...input, sourceMessageId: 'ai', operator: { id: 'irrelevant', name: 'Ignored' } })
  assert.equal(ai.job.operator, undefined)
  await store.createCompositionJob('other', { ...input, source: 'operator', operator: { id: 'foreign', name: 'Outro tenant' } })
  state.jobs.forEach(job => { job.createdAt = new Date(Date.now() - 1000).toISOString() })
  state.jobs.push({ ...created.body.job, id: 'old-job', createdAt: new Date(Date.now() - 40 * 86400000).toISOString() })
  const analyticsUrl = 'http://127.0.0.1:3000/api/tenant/test/analytics?range=7d'
  const readRequest = { url: analyticsUrl, nextUrl: new URL(analyticsUrl), headers: new Headers() }
  const report = await analytics.GET(readRequest, context)
  assert.equal(report.status, 200)
  const rows = JSON.parse(JSON.stringify(report.body.operatorGenerationData))
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.find(row => row.id === 'operator-a'), { id: 'operator-a', name: 'Ana', generations: 1, completed: 1, failed: 0 })
  assert.equal(rows.find(row => row.id === 'operator-b').generations, 1)
  assert.equal(rows.find(row => row.id === null).name, 'Operador não registrado')
  assert.ok(report.body.reviewQueue.some(job => job.operatorName === 'Bruno'))
  const before = state.jobs.length
  token = null
  assert.equal((await route.POST(request(input), context)).status, 401)
  assert.equal((await analytics.GET(readRequest, context)).status, 401)
  token = { ...claims, tenantSlug: 'other' }
  assert.equal((await route.POST(request(input), context)).status, 403)
  assert.equal((await analytics.GET(readRequest, context)).status, 403)
  token = { ...claims, exp: Date.now() / 1000 - 10 }
  assert.equal((await route.POST(request(input), context)).status, 401)
  token = claims
  const crossOrigin = request(input); crossOrigin.headers.set('origin', 'https://other.invalid')
  assert.equal((await route.POST(crossOrigin, context)).status, 403)
  assert.equal(state.jobs.length, before)
  assert.equal(enqueueCalls, 3)
})

test('catalog jobs require entitlement and active tenant item, reject incompatible targets, and ignore forged reference metadata', async () => {
  const access = await load('../lib/server/studio-surface-access.ts', () => ({}))
  let enabled = false, created = 0, captured
  const item = { id: 'wall', tenantSlug: 'test', status: 'active', name: 'Parede', category: 'Revestimentos para parede', description: 'Material demonstrativo', sku: 'W1', tags: { product_type: 'revestimento' } }
  let items = [item]
  const route = await load('../app/api/tenant/[slug]/compositions/jobs/route.ts', name => {
    if (name === 'next/server') return { NextResponse: { json: (body,opts) => ({body,status:opts?.status||200}) } }
    if (name === 'zod') return require('zod')
    if (name === '@/lib/server/current-tenant-token') return {getCurrentTenantToken:async()=>({sub:'u1',exp:Date.now()/1000+60,tenantSlug:'test',tenantId:'t1',roles:['tenant_operator']})}
    if (name.includes('studio-surface-access')) return access
    if (name.includes('tenants-store')) return {findTenant:async()=>({id:'t1',slug:'test',status:'active'})}
    if (name.includes('tenant-catalog-access')) return {getTenantCatalogAccess:async()=>({included:enabled,enabled})}
    if (name.includes('catalog-store')) return {listCatalogItems:async()=>items}
    if (name.includes('studio-v1')) return {matchesStudioMaterial:(_,__,___,surface)=>surface==='walls'}
    if (name.includes('composition-jobs-store')) return {createCompositionJob:async(_,input)=>{created++;captured=input;return {created:true,job:{id:'job',status:'done'}}}}
    if (name.includes('composition-base-snapshots')) return {ensureCompositionBaseSnapshot:async job=>job}
    if (name.includes('token-ledger-store')) return {canTenantCreateComposition:async()=>({allowed:true})}
    if (name.includes('image-normalization')) return {normalizeDataImageUrlForUpload:async url=>url}
    return {}
  })
  const input = {conversationId:'studio:test',channelInstanceId:'studio',contactName:'Teste',studioVersion:'v1',purpose:'studio-preset',presetIds:['flooring'],baseImageUrl:'base',prompt:'Aplicar acabamento',references:[{source:'catalog',catalogItemId:'wall',materialPreset:'flooring',materialSurface:'walls',imageUrl:'https://other-tenant.example/image',catalogItemName:'Forged'}]}
  const request = data => ({url:'http://127.0.0.1:3000/api',nextUrl:new URL('http://127.0.0.1:3000/api'),headers:new Headers({host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}),json:async()=>structuredClone(data)})
  const context = {params:Promise.resolve({slug:'test'})}
  assert.equal((await route.POST(request(input),context)).status,403)
  enabled=true
  assert.equal((await route.POST(request({...input,references:[{...input.references[0],materialSurface:'floor'}]}),context)).status,400)
  items=[{...item,tenantSlug:'other'}]
  assert.equal((await route.POST(request(input),context)).status,400)
  items=[{...item,status:'inactive'}]
  assert.equal((await route.POST(request(input),context)).status,400)
  assert.equal(created,0)
  items=[item]
  assert.equal((await route.POST(request({...input,references:[{source:'url',catalogItemId:'wall',imageUrl:'https://forged.example/asset'}]}),context)).status,400)
  assert.equal((await route.POST(request({...input,catalogItemId:'wall',references:[]}),context)).status,400)
  assert.equal(created,0)
  assert.equal((await route.POST(request(input),context)).status,201)
  assert.equal(captured.references[0].imageUrl,undefined)
  assert.equal(captured.references[0].catalogItemName,'Parede')
  assert.equal(captured.references[0].materialSurface,'walls')
})
