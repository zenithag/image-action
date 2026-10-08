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
  runInNewContext(code, { exports, require: resolve, process: { env: {} }, setTimeout, clearTimeout })
  return exports
}
test('only confirmed preservation passes; changed, uncertain and malformed results are blocked', async () => {
  const fidelity = await load('../lib/server/composition-fidelity.ts', () => ({}))
  fidelity.assertCompositionFidelity('{"camera":"preserved","structure":"preserved"}')
  for (const verdict of [null, {}, {camera: true, structure: true}, {camera:'changed', structure:'preserved'}, {camera:'preserved', structure:'changed'}, {camera:'uncertain', structure:'preserved'}, {camera:'preserved', structure:'uncertain'}]) {
    assert.throws(() => fidelity.assertCompositionFidelity(JSON.stringify(verdict)))
  }
  assert.throws(() => fidelity.assertCompositionFidelity('not JSON'))
})
test('a rejected composition fails without delivering a result or debiting customer credits', async () => {
  let job = { id: 'job', tenantSlug: 'test', status: 'queued', purpose: 'studio-preset', processingAttempts: 0 }
  let debits = 0
  let deliveries = 0
  const processor = await load('../lib/server/composition-processor.ts', name => {
    if (name.endsWith('tenants-store')) return { findTenant: async () => ({status: 'active'}) }
    if (name.endsWith('composition-jobs-store')) return { findCompositionJob: async () => job, updateCompositionJob: async (_, __, patch) => (job = {...job, ...patch}) }
    if (name.endsWith('ai-observability-store')) return { recordAiTrace: async () => {} }
    if (name.endsWith('openrouter-image-worker')) return { processCompositionWithOpenRouter: async () => { throw new Error('Câmera ou estrutura alterada. Resultado bloqueado.') } }
    if (name.endsWith('token-ledger-store')) return { recordCompositionTokenDebit: async () => { debits++ } }
    if (name.endsWith('uazapi-client')) return { sendUazapiImage: async () => { deliveries++ } }
    return {}
  })
  const result = await processor.processCompositionJob('test', 'job')
  assert.equal(result.ok, false)
  assert.equal(job.status, 'failed')
  assert.equal(job.resultImageUrl, undefined)
  assert.equal(debits, 0)
  assert.equal(deliveries, 0)
})
test('vision compares both images, records provider cost, and rejects structural change', async () => {
  let recorded = 0
  let inspected = 0
  const fidelity = await load('../lib/server/composition-fidelity.ts', name => {
    if (name.endsWith('ai-model-profiles-store')) return { getAiModelProfile: async () => ({ enabled: true, modelId: 'vision', fallbackModelIds: [] }) }
    if (name.endsWith('openrouter-client')) return { createOpenRouterChatCompletion: async input => {
      assert.deepEqual(Array.from(input.messages[1].content, part => part.image_url.url), ['base', 'result'])
      inspected++
      return { content: '{"camera":"preserved","structure":"changed"}', model: 'vision', raw: {usage: {cost: 0.01}} }
    } }
    if (name.endsWith('generation-costs')) return { readGenerationUsage: raw => raw.usage }
    if (name.endsWith('composition-jobs-store')) return { recordCompositionGenerationUsage: async (_, __, usage) => { assert.equal(usage.cost, 0.01); recorded++ } }
    return {}
  })
  await assert.rejects(fidelity.verifyCompositionFidelity({}, {tenantSlug:'test', id:'job'}, 'base', 'result'), /Resultado bloqueado/)
  assert.equal(inspected, 1)
  assert.equal(recorded, 1)
})
