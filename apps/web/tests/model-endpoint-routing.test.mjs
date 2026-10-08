import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
async function load(file, context = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8')
  const exports = {}
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, AbortSignal, process: { env: {} }, ...context })
  return exports
}
const types = await load('../lib/ai-types.ts')
const costs = await load('../lib/generation-costs.ts')
const imageModel = { id: 'meta/muse-image', name: 'Muse Image', architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] }, supported_parameters: {} }
const chatModel = { id: 'chosen/chat-image', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text', 'image'] }, pricing: { prompt: '0.001' } }
const textModel = { id: 'chosen/text', architecture: { input_modalities: ['text'], output_modalities: ['text'] } }
const reply = (data, status = 200) => ({ ok: status === 200, status, text: async () => JSON.stringify({ data }) })
const provider = { id: 'test-provider', baseUrl: 'https://synthetic.invalid/api/v1' }
async function client(fetch) { return load('../lib/server/openrouter-client.ts', { fetch, require: () => types }) }

test('image discovery merges with chat catalog, preserves prices and enforces purpose compatibility', async () => {
  const api = await client(async url => reply(url.endsWith('/images/models') ? [imageModel, { ...chatModel, pricing: undefined }] : [chatModel, textModel]))
  const models = await api.listOpenRouterModels(provider)
  assert.equal(models.length, 3)
  assert.equal(models.find(m => m.id === chatModel.id).promptPrice, '0.001')
  assert.equal(models.find(m => m.id === imageModel.id).imageEndpoint, true)
  const profile = { modelId: imageModel.id, purpose: 'image_generation', fallbackModelIds: ['ignored/paid-fallback'] }
  await api.validateOpenRouterProfile(provider, profile)
  for (const purpose of ['conversation', 'classification', 'composition_review']) await assert.rejects(api.validateOpenRouterProfile(provider, { ...profile, purpose, fallbackModelIds: [] }), /não é compatível/)
  await assert.rejects(api.validateOpenRouterProfile(provider, { ...profile, modelId: textModel.id }), /não é compatível/)
  await assert.rejects(api.validateOpenRouterProfile(provider, { ...profile, modelId: textModel.id, purpose: 'conversation', fallbackModelIds: [imageModel.id] }), /não é compatível/)
})

async function worker(catalog, payload) {
  const requests = [], usage = []
  const api = await client(async url => reply(url.endsWith('/images/models') ? catalog : [chatModel, textModel]))
  const source = await readFile(new URL('../lib/server/openrouter-image-worker.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('worker.ts', source, ts.ScriptTarget.Latest, true)
  const names = ['requestOpenRouterImage', 'getImageUrlFromPayload', 'getImageUrlFromUnknown', 'bytesFromImageUrl']
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast))
  const context = {
    Buffer, AbortSignal, ...types, ...costs, ...api,
    appendPath: (url, path) => url + path,
    getOpenRouterHeaders: () => ({}),
    getOpenRouterImageConfig: () => ({ aspect_ratio: '9:16', image_size: '1K', quality: 'medium', output_format: 'webp' }),
    recordCompositionGenerationUsage: async (_tenant, _id, value) => usage.push(value),
    getOpenRouterError: () => 'HTTP error', getPayloadTextPreview: () => '', getPayloadNoImageDiagnostic: () => 'no image',
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => payload } },
  }
  runInNewContext(ts.transpileModule(functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
  return { context, requests, usage }
}
const content = [{ type: 'text', text: 'Restore the ORIGINAL room; material reference is image 2.' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,b3JpZ2luYWw=', detail: 'high' } }, { type: 'image_url', image_url: { url: 'https://synthetic.invalid/material.png' } }]
const job = { id: 'test-job', tenantSlug: 'test' }

test('saved Muse model uses images API once, keeps ordered references and records base64 output and cost without inventing an ID', async () => {
  const state = await worker([imageModel], { data: [{ b64_json: Buffer.from('image bytes').toString('base64'), media_type: 'image/webp' }], usage: { cost: 0.01, completion_tokens: 100 } })
  const result = await state.context.requestOpenRouterImage(provider, imageModel.id, job, {}, content, { temperature: 0.9, maxTokens: 100 })
  assert.equal(result.model, imageModel.id)
  assert.equal(result.bytes.toString(), 'image bytes')
  assert.equal(result.mimeType, 'image/webp')
  assert.equal(state.requests.length, 1)
  assert.equal(state.requests[0].url, provider.baseUrl + '/images')
  const body = state.requests[0].body
  assert.equal(body.model, imageModel.id)
  assert.equal(body.n, 1)
  assert.equal(body.prompt, content[0].text)
  assert.deepEqual(body.input_references.map(r => r.image_url.url), content.filter(c => c.type === 'image_url').map(c => c.image_url.url))
  for (const key of ['messages', 'temperature', 'max_tokens', 'aspect_ratio', 'resolution']) assert.equal(key in body, false)
  assert.equal(state.usage[0].costUsd, 0.01)
  assert.equal(state.usage[0].outcome, 'image')
  assert.equal(state.usage[0].requestId, undefined)
})

test('legacy chat image models retain their endpoint and dedicated models only receive supported dimensions', async () => {
  const legacy = await worker([], { choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,aW1hZ2U=' } }] } }] })
  await legacy.context.requestOpenRouterImage(provider, chatModel.id, job, {}, content, {})
  assert.equal(legacy.requests[0].url, provider.baseUrl + '/chat/completions')
  assert.equal(legacy.requests[0].body.model, chatModel.id)
  assert.equal(legacy.requests[0].body.messages[0].content[1].image_url.url, content[1].image_url.url)
  const dedicated = await worker([{ ...imageModel, supported_parameters: { aspect_ratio: { type: 'enum', values: ['9:16'] }, resolution: { type: 'enum', values: ['1K'] } } }], { data: [{ b64_json: 'aW1hZ2U=' }] })
  await dedicated.context.requestOpenRouterImage(provider, imageModel.id, job, {}, content, {})
  assert.equal(dedicated.requests[0].body.aspect_ratio, '9:16')
  assert.equal(dedicated.requests[0].body.resolution, '1K')
})

test('incompatible models and reference overflow stop before any paid generation', async () => {
  const state = await worker([{ ...imageModel, supported_parameters: { input_references: { type: 'range', max: 1 } } }], {})
  await assert.rejects(state.context.requestOpenRouterImage(provider, textModel.id, job, {}, content, {}), /não suporta edição/)
  await assert.rejects(state.context.requestOpenRouterImage(provider, imageModel.id, job, {}, content, {}), /até 1 imagens/)
  assert.equal(state.requests.length, 0)
  assert.equal(state.usage.length, 0)
})

test('actual profile PATCH rejects incompatible saved models without overwriting settings', async () => {
  const api = await client(async url => reply(url.endsWith('/images/models') ? [imageModel] : [textModel]))
  let writes = 0
  let profiles = [{ id: 'conversation', purpose: 'conversation', modelId: textModel.id, fallbackModelIds: [], enabled: true }]
  const store = await load('../lib/server/ai-model-profiles-store.ts', { crypto: globalThis.crypto, require: name => name.endsWith('postgres-json-store') ? { readJsonStore: async () => profiles, writeJsonStore: async (_, value) => { profiles = value; writes++ } } : name.endsWith('ai-providers-store') ? { getActiveOpenRouterProvider: async () => provider } : name.endsWith('openrouter-client') ? api : { getRuntimeDataFile: () => 'synthetic' } })
  const route = await load('../app/api/superadmin/ai/profiles/[id]/route.ts', { require: name => name === 'next/server' ? { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } } : name.endsWith('superadmin-api-auth') ? { requireSuperadmin: async () => null } : store })
  const context = { params: Promise.resolve({ id: 'conversation' }) }
  const rejected = await route.PATCH({ json: async () => ({ modelId: imageModel.id }) }, context)
  assert.equal(rejected.status, 400)
  assert.equal(writes, 0)
  assert.equal(profiles[0].modelId, textModel.id)
  const saved = await route.PATCH({ json: async () => ({ purpose: 'image_generation', modelId: imageModel.id }) }, context)
  assert.equal(saved.status, 200)
  assert.equal(writes, 1)
  assert.equal(profiles[0].modelId, imageModel.id)
})
