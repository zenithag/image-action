import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
async function load(file, resolve = () => ({}), globals = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports = {}
  runInNewContext(code, {exports, require:resolve, URL, AbortSignal, crypto:globalThis.crypto, ...globals})
  return exports
}
const costs = await load('../lib/generation-costs.ts')
const job = {id:'job', tenantSlug:'tenant', purpose:'composition', originalPurpose:'studio-preset', status:'done', createdAt:'2026-10-08', processingAttempts:1, generationUsage:[
  {requestId:'gen-1', kind:'generation', outcome:'image', costUsd:.1, model:'image'},
  {requestId:'review-1', kind:'review', outcome:'rejected', costUsd:.01, model:'vision'},
  {requestId:'gen-2', kind:'generation', outcome:'image', costUsd:.2, model:'image'},
  {requestId:'review-2', kind:'review', outcome:'approved', costUsd:0, model:'vision', verifiedAt:'today'},
  {model:'historical'},
]}

test('one request reports two image attempts separately from reviews, costs and origin/destination', () => {
  const summary = costs.summarizeCompositionRequest(job)
  assert.equal(summary.providerRequests, 5)
  assert.equal(summary.generations, 2)
  assert.equal(summary.reviews, 2)
  assert.equal(summary.imagesReturned, 2)
  assert.equal(summary.rejections, 1)
  assert.equal(summary.unclassified, 1)
  assert.equal(summary.verifiedRequests, 1)
  assert.equal(summary.chargedRequests, 3)
  assert.equal(summary.missingRequestIds, 1)
  assert.equal(summary.completeCostUsd, null)
  assert.equal(summary.purpose, 'composition')
  assert.equal(summary.originalPurpose, 'studio-preset')
  assert.equal(costs.summarizeCompositionRequest({...job, originalPurpose:undefined}).originalPurpose, null)
})

test('API metadata validates ID and cost, accepts real zero, and makes only a read request', async () => {
  let body = {data:{id:'gen-1', total_cost:0, tokens_prompt:10, tokens_completion:20, num_media_completion:2, finish_reason:'stop'}}
  const client = await load('../lib/server/openrouter-client.ts', undefined, {process:{env:{}}, fetch:async (url, options) => {
    assert.equal(url.pathname, '/api/v1/generation')
    assert.equal(url.searchParams.get('id'), 'gen-1')
    assert.equal(options.body, undefined)
    assert.equal(options.headers.Authorization, 'Bearer server-only')
    return {ok:true, text:async () => JSON.stringify(body)}
  }})
  const provider = {baseUrl:'https://openrouter.ai/api/v1',apiKey:'server-only'}
  const result = await client.getOpenRouterGeneration(provider, 'gen-1')
  assert.equal(result.costUsd, 0)
  assert.equal(result.outputMedia, 2)
  assert.ok(result.verifiedAt)
  body = {data:{id:'other', total_cost:10}}
  await assert.rejects(client.getOpenRouterGeneration(provider, 'gen-1'))
  body = {data:{id:'gen-1', total_cost:-1}}
  assert.equal((await client.getOpenRouterGeneration(provider, 'gen-1')).costUsd, undefined)
})

test('reconciliation uses the correct account, keeps missing IDs unknown, and never adds another generation', async () => {
  const calls = [], patches = []
  const history = {...job, generationUsage:[{requestId:'one', providerId:'account-a'}, {requestId:'two', providerId:'removed'}, {model:'unknown'}]}
  const service = await load('../lib/server/composition-logs.ts', name => {
    if (name.endsWith('composition-jobs-store')) return {findCompositionJob:async (tenant, id) => tenant === 'tenant' && id === 'job' ? history : null, updateCompositionGenerationUsage:async (...args) => patches.push(args)}
    if (name.endsWith('ai-providers-store')) return {readAiProviders:async () => [{id:'account-a', apiKey:'a'}, {id:'account-b', apiKey:'b'}]}
    if (name.endsWith('openrouter-client')) return {getOpenRouterGeneration:async (provider, id) => {calls.push([provider.id,id]); return {costUsd:0, verifiedAt:'today'}}}
    return {}
  })
  const result = await service.reconcileCompositionLog('tenant', 'job')
  assert.deepEqual(Array.from(calls, row => Array.from(row)), [['account-a','one']])
  assert.equal(result.verified, 1)
  assert.equal(result.notVerified, 2)
  assert.equal(patches.length, 1)
  assert.equal(await service.reconcileCompositionLog('other-tenant', 'job'), null)
})

test('stored preset origin survives promotion; reconciliation updates the same request and preserves unknown cost', async () => {
  let state = {jobs:[]}
  const store = await load('../lib/server/composition-jobs-store.ts', name => name.endsWith('postgres-json-store') ? {
    readJsonStore:async () => structuredClone(state), writeJsonStore:async (_, value) => {state = structuredClone(value)}, withJsonStoreLock:async (_, __, fn) => fn(),
  } : name.endsWith('tenant-settings-store') ? {getTenantSettings:async () => ({team:{members:[]}})} : {getRuntimeDataFile:() => 'synthetic'})
  const {job:created} = await store.createCompositionJob('tenant', {purpose:'studio-preset', prompt:'paint', conversationId:'studio:tenant'})
  await store.updateCompositionJob('tenant', created.id, {status:'done',resultImageUrl:'approved'})
  await store.recordCompositionGenerationUsage('tenant',created.id,{requestId:'one',kind:'generation',model:'image',costUsd:.2,createdAt:'today'})
  const promoted = await store.saveStudioPresetJobAsComposition('tenant',created.id)
  assert.equal(promoted.job.purpose,'composition')
  assert.equal(promoted.job.originalPurpose,'studio-preset')
  await store.updateCompositionGenerationUsage('tenant',created.id,'one',{costUsd:0,verifiedAt:'today'})
  await store.updateCompositionGenerationUsage('tenant',created.id,'one',{costUsd:undefined,outputMedia:1})
  const result = await store.findCompositionJob('tenant',created.id)
  assert.equal(result.generationUsage.length,1)
  assert.equal(result.generationUsage[0].costUsd,0)
  assert.equal(result.generationUsage[0].kind,'generation')
  await assert.rejects(store.updateCompositionGenerationUsage('other',created.id,'one',{costUsd:100}))
})

test('logs endpoint denies unauthenticated access and validates identifiers before any provider lookup', async () => {
  let deny = {status:401}, list = 0, reconciliations = 0
  const api = await load('../app/api/superadmin/composition-logs/route.ts', name => {
    if (name === 'next/server') return {NextResponse:{json:(body,opts) => ({body,status:opts?.status ?? 200})}}
    if (name === 'zod') return require('zod')
    if (name.endsWith('superadmin-api-auth')) return {requireSuperadmin:async () => deny}
    if (name.endsWith('composition-logs')) return {listCompositionLogs:async () => {list++; return []},reconcileCompositionLog:async () => {reconciliations++; return {verified:0,notVerified:1}}}
    return {}
  })
  assert.equal((await api.GET()).status,401)
  assert.equal((await api.POST({json:async () => ({})})).status,401)
  assert.equal(list,0)
  assert.equal(reconciliations,0)
  deny = null
  assert.equal((await api.POST({json:async () => ({tenantSlug:'tenant',jobId:'invalid'})})).status,400)
  assert.equal(reconciliations,0)
  assert.equal((await api.GET()).status,200)
  assert.equal(list,1)
})

test('log listing includes presets and archived failures without exposing prompts, images or credentials', async () => {
  const history = [{...job, archivedAt:'today', prompt:'private briefing', baseImageUrl:'private photo'}, {...job,id:'preset', purpose:'studio-preset', originalPurpose:'studio-preset', status:'failed'}]
  const service = await load('../lib/server/composition-logs.ts', name => {
    if (name.endsWith('generation-costs')) return costs
    if (name.endsWith('tenants-store')) return {listTenants:async () => [{slug:'tenant',name:'Client'}]}
    if (name.endsWith('composition-jobs-store')) return {listCompositionJobs:async (tenant, options) => {assert.equal(tenant,'tenant');assert.equal(options.includeArchived,true);return history}}
    return {}
  })
  const entries = await service.listCompositionLogs()
  assert.equal(entries.length,2)
  assert.equal(entries[0].summary.generations,2)
  assert.equal(entries[1].summary.purpose,'studio-preset')
  for (const entry of entries) {
    assert.equal(entry.prompt,undefined)
    assert.equal(entry.baseImageUrl,undefined)
    assert.equal(entry.apiKey,undefined)
  }
})
