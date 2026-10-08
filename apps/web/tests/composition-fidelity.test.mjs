import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
async function load(path, resolve, globals = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  runInNewContext(code, { exports, require: resolve, process: { env: {} }, setTimeout, clearTimeout, AbortController, AbortSignal, ...globals })
  return exports
}
const pass = { camera:'preserved', structure:'preserved', request:'passed', quality:'passed', issues:[] }
const reject = { ...pass, structure:'changed', issues:['Restore the half wall beside the door.'] }
const parse = async () => (await load('../lib/server/composition-fidelity.ts', () => ({}))).parseCompositionReview

test('all criteria must pass; invalid reviews are blocked, uncertainty and contradictory issues reject', async () => {
  const review = await parse()
  assert.equal(review(JSON.stringify(pass)).approved, true)
  for (const field of ['camera', 'structure', 'request', 'quality']) {
    assert.equal(review(JSON.stringify({...pass, [field]:'uncertain'})).approved, false)
  }
  assert.equal(review(JSON.stringify({...pass, issues:['Missing paint']})).approved, false)
  for (const value of [null, {}, {...pass, camera:true}, {...pass, quality:'excellent'}, {...pass, issues:[42]}, {...pass, issues:['']}, {...pass, issues:Array(13).fill('problem')}]) {
    assert.throws(() => review(JSON.stringify(value)), /bloqueado/)
  }
  assert.throws(() => review('not JSON'), /bloqueado/)
})

test('a rejection feeds corrections to the next generation and only the approved candidate is returned', async () => {
  const fidelity = await load('../lib/server/composition-fidelity.ts', () => ({}))
  const attempts = []
  const result = await fidelity.composeWithFidelityReview(async (issues, attempt) => {
    attempts.push({issues:Array.from(issues), attempt})
    return `candidate-${attempt}`
  }, async (_, attempt) => fidelity.parseCompositionReview(JSON.stringify(attempt === 1 ? reject : pass)))
  assert.equal(result, 'candidate-2')
  assert.deepEqual(attempts, [{issues:[], attempt:1}, {issues:reject.issues, attempt:2}])
})

test('three rejected candidates exhaust the budget; broken reviewer stops after one', async () => {
  const fidelity = await load('../lib/server/composition-fidelity.ts', () => ({}))
  let generations = 0
  await assert.rejects(fidelity.composeWithFidelityReview(async () => ++generations, async () => fidelity.parseCompositionReview(JSON.stringify(reject))), /após 3 tentativas/)
  assert.equal(generations, 3)
  for (const content of ['invalid JSON', '{}']) {
    generations = 0
    await assert.rejects(fidelity.composeWithFidelityReview(async () => ++generations, async () => fidelity.parseCompositionReview(content)), /bloqueado/)
    assert.equal(generations, 1)
  }
  generations = 0
  await assert.rejects(fidelity.composeWithFidelityReview(async () => ++generations, async () => {throw new Error('provider unavailable')}), /provider unavailable/)
  assert.equal(generations, 1)
})

test('cancellation during review prevents regeneration or returning a result', async () => {
  const fidelity = await load('../lib/server/composition-fidelity.ts', () => ({}))
  const controller = new AbortController()
  let generations = 0
  await assert.rejects(fidelity.composeWithFidelityReview(async () => ++generations, async () => {
    controller.abort(new Error('deadline exceeded'))
    return fidelity.parseCompositionReview(JSON.stringify(pass))
  }, controller.signal), /deadline exceeded/)
  assert.equal(generations, 1)
})

test('an exhausted review fails the real processor without delivery or customer debit; approval debits once', async () => {
  const fidelity = await load('../lib/server/composition-fidelity.ts', () => ({}))
  for (const approved of [false, true]) {
    let job = { id:'job', tenantSlug:'test', status:'queued', purpose:'studio-preset', processingAttempts:0 }
    let debits = 0
    let deliveries = 0
    const processor = await load('../lib/server/composition-processor.ts', name => {
      if (name.endsWith('tenants-store')) return { findTenant: async () => ({status:'active'}) }
      if (name.endsWith('composition-jobs-store')) return { findCompositionJob: async () => job, updateCompositionJob: async (_, __, patch) => (job = {...job, ...patch}) }
      if (name.endsWith('ai-observability-store')) return { recordAiTrace: async () => {} }
      if (name.endsWith('openrouter-image-worker')) return { processCompositionWithOpenRouter: async (_, signal) => fidelity.composeWithFidelityReview(async () => ({resultImageUrl:'approved-only', baseImageUrl:'base', provider:'openrouter', model:'selected'}), async () => fidelity.parseCompositionReview(JSON.stringify(approved ? pass : reject)), signal) }
      if (name.endsWith('token-ledger-store')) return { recordCompositionTokenDebit: async () => { debits++ } }
      if (name.endsWith('uazapi-client')) return { sendUazapiImage: async () => { deliveries++ } }
      return {}
    })
    const result = await processor.processCompositionJob('test', 'job')
    assert.equal(result.ok, approved)
    assert.equal(job.status, approved ? 'done' : 'failed')
    assert.equal(job.resultImageUrl, approved ? 'approved-only' : undefined)
    assert.equal(debits, approved ? 1 : 0)
    assert.equal(deliveries, 0) // Studio stores the approved result; no WhatsApp delivery.
  }
})

test('dedicated reviewer sees original, result, request and references, and records each review cost and verdict', async () => {
  let recorded = 0
  let traces = 0
  const fidelity = await load('../lib/server/composition-fidelity.ts', name => {
    if (name.endsWith('ai-model-profiles-store')) return { readAiModelProfiles: async () => [{purpose:'vision', enabled:true, modelId:'wrong'}, {purpose:'composition_review', enabled:true, modelId:'reviewer', fallbackModelIds:[]}] }
    if (name.endsWith('openrouter-client')) return { createOpenRouterChatCompletion: async input => {
      assert.equal(input.profile.modelId, 'reviewer')
      assert.equal(input.profile.temperature, 0)
      assert.equal(input.responseFormat.type, 'json_object')
      assert.match(input.messages[1].content[0].text, /paint and remove cabinets/)
      assert.deepEqual(Array.from(input.messages[1].content.filter(part => part.image_url), part => part.image_url.url), ['base', 'result', 'material'])
      return {content:JSON.stringify(reject), model:'reviewer', raw:{usage:{cost:0.01}}}
    } }
    if (name.endsWith('generation-costs')) return { readGenerationUsage: raw => raw.usage }
    if (name.endsWith('composition-jobs-store')) return { recordCompositionGenerationUsage: async (_, __, usage) => {assert.equal(usage.cost, 0.01); recorded++} }
    if (name.endsWith('ai-observability-store')) return { recordAiTrace: async input => {assert.equal(input.event, 'composition_review_rejected'); assert.equal(input.details.attempt, 2); traces++} }
    return {}
  })
  const verdict = await fidelity.verifyCompositionFidelity({}, {tenantSlug:'test', id:'job', mode:'interior'}, 'base', 'result', 'paint and remove cabinets', ['material'], undefined, 2)
  assert.equal(verdict.approved, false)
  assert.equal(recorded, 1)
  assert.equal(traces, 1)
})

test('disabled dedicated reviewer never falls back to the conversation/vision model', async () => {
  let calls = 0
  const fidelity = await load('../lib/server/composition-fidelity.ts', name => {
    if (name.endsWith('ai-model-profiles-store')) return { readAiModelProfiles: async () => [{purpose:'composition_review', enabled:false}, {purpose:'vision', enabled:true}] }
    if (name.endsWith('openrouter-client')) return { createOpenRouterChatCompletion: async () => {calls++} }
    return {}
  })
  await assert.rejects(fidelity.verifyCompositionFidelity({}, {tenantSlug:'test', id:'job'}, 'base', 'result', 'request'), /modelo de avaliação/)
  assert.equal(calls, 0)
})

async function workerEntry(globals) {
  const source = await readFile(new URL('../lib/server/openrouter-image-worker.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('worker.ts', source, ts.ScriptTarget.Latest, true)
  const entry = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'processCompositionWithOpenRouter')
  assert.ok(entry)
  const exports = {}
  const code = ts.transpileModule(entry.getText(ast), {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText
  runInNewContext(code, {exports, Buffer, ...globals})
  return exports.processCompositionWithOpenRouter
}

test('actual worker reviews both render paths, regenerates from original and saves only after approval', async () => {
  const fidelity = await load('../lib/server/composition-fidelity.ts', () => ({}))
  for (const local of [false, true]) {
    for (const approved of [false, true]) {
      const job = {id:'job', tenantSlug:'test', baseImageUrl:'original', mode:'interior'}
      const base = {dataUrl:'original-pixels', bytes:Buffer.from('base'), mimeType:'image/png'}
      let saves = 0, reviews = 0, generations = 0
      const process = await workerEntry({
        getActiveOpenRouterProvider: async () => ({}),
        readAiModelProfiles: async () => [{purpose:'composition_review', enabled:true}],
        getBaseImage: async () => base,
        isDurableCompositionBaseImageUrl: () => true,
        getTenantSettings: async () => ({segmentation:{editableTargets:[], protectedTargets:['half wall'], promptHints:[]}}),
        buildPrompt: () => 'paint and remove furniture',
        getCatalogMaterialImages: async () => ['reference'],
        shouldUseLocalSurfaceRender: () => local,
        isLocalizedSurfaceColorRequest: async () => true,
        requestExternalSurfaceMask: async () => ({provider:'mask', model:'sam'}),
        requestExternalForegroundMask: async () => null,
        renderOriginalSurface: async () => Buffer.from('local'),
        composeWithFidelityReview: fidelity.composeWithFidelityReview,
        generateImageWithOpenRouter: async (_, actualJob, actualBase, prompt) => {
          assert.equal(actualJob, job)
          assert.equal(actualBase, base)
          assert.match(prompt, /paint and remove furniture/)
          assert.match(prompt, /half wall/)
          if (reviews) assert.match(prompt, /Restore the half wall/)
          generations++
          return {bytes:Buffer.from('generated'), mimeType:'image/png', model:'selected'}
        },
        normalizeResultToBaseDimensions: async bytes => ({bytes, mimeType:'image/webp'}),
        verifyCompositionFidelity: async (_, actualJob, original, result, prompt, refs, signal, attempt) => {
          assert.equal(saves, 0)
          assert.equal(actualJob, job)
          assert.equal(original, 'original-pixels')
          assert.match(result, /^data:image\/webp;base64,/)
          assert.match(prompt, /half wall/)
          assert.deepEqual(Array.from(refs), ['reference'])
          assert.equal(attempt, ++reviews)
          return fidelity.parseCompositionReview(JSON.stringify(approved && attempt === 2 ? pass : reject))
        },
        saveImageResult: async () => {saves++; return 'approved-result'},
      })
      if (approved) {
        assert.equal((await process(job)).resultImageUrl, 'approved-result')
        assert.equal(saves, 1)
        assert.equal(reviews, 2)
      } else {
        await assert.rejects(process(job), /após 3 tentativas/)
        assert.equal(saves, 0)
        assert.equal(reviews, 3)
      }
      assert.equal(generations, reviews - (local ? 1 : 0))
    }
  }
})

test('processor deadline aborts the active operation rather than allowing background retries', async () => {
  const source = await readFile(new URL('../lib/server/composition-processor.ts', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('processor.ts', source, ts.ScriptTarget.Latest, true)
  const timeout = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'withTimeout')
  const code = ts.transpileModule(`${timeout.getText(ast)}\nexports.withTimeout = withTimeout`, {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText
  const exports = {}
  runInNewContext(code, {exports, setTimeout, clearTimeout, AbortController})
  let observedSignal
  await assert.rejects(exports.withTimeout(signal => {
    observedSignal = signal
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once:true}))
  }, 5), /Timeout ao processar/)
  assert.equal(observedSignal.aborted, true)
})
