import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
const source = await readFile(new URL('../lib/generation-costs.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { summarizeGenerationJobCost, summarizeGenerationCosts } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const job = (status, costs) => ({ prompt: '', status, processingAttempts: 1, generationUsage: costs?.map(costUsd => ({costUsd})) })

test('job cost includes all retries/fallbacks and distinguishes genuine zero from incomplete totals', () => {
  const cost = summarizeGenerationJobCost(job('done', [.1,.2,0]))
  assert.equal(cost.attempts, 3)
  assert.ok(Math.abs(cost.completeCostUsd - .3) < 1e-10)
  assert.equal(summarizeGenerationJobCost(job('done', [0])).completeCostUsd, 0)
  for (const missing of [undefined, null, -1, NaN, Infinity]) {
    const partial = summarizeGenerationJobCost(job('done', [.1, missing]))
    assert.equal(partial.completeCostUsd, null)
    assert.equal(partial.knownCostUsd, .1)
    assert.equal(partial.unknownCosts, 1)
  }
})

test('averages use fully measured terminal jobs, include failed spending and expose incomplete coverage', () => {
  const [row] = summarizeGenerationCosts([
    job('done', [.1,.2]), job('done', [0]), job('failed', [.3]),
    job('done', [.4, undefined]), job('failed'), job('processing', [9]),
    {...job('queued'), processingAttempts: 0},
  ])
  assert.equal(row.jobs, 7)
  assert.equal(row.completed, 3)
  assert.equal(row.failed, 2)
  assert.equal(row.jobsWithUnknownCost, 2)
  assert.equal(row.completedWithCompleteCost, 2)
  assert.equal(row.failedWithCompleteCost, 1)
  assert.ok(Math.abs(row.knownCostUsd - 10) < 1e-10)
  assert.ok(Math.abs(row.averageCompletedCostUsd - .15) < 1e-10)
  assert.equal(row.averageFailedCostUsd, .3)
  assert.ok(Math.abs(row.costPerSuccessfulResultUsd - .3) < 1e-10)
  assert.ok(Math.abs(row.averageTerminalJobCostUsd - .2) < 1e-10)
})

test('missing historical costs and no successful outcomes never become fabricated zero averages', () => {
  const [missing] = summarizeGenerationCosts([job('done'), job('failed')])
  assert.equal(missing.unknownCosts, 2)
  assert.equal(missing.averageCompletedCostUsd, null)
  assert.equal(missing.costPerSuccessfulResultUsd, null)
  const [failed] = summarizeGenerationCosts([job('failed', [0])])
  assert.equal(failed.averageFailedCostUsd, 0)
  assert.equal(failed.costPerSuccessfulResultUsd, null)
  const groups = summarizeGenerationCosts([{...job('done', [.2]), presetIds: ['fresh-paint']}, {...job('failed', [.1]),presetIds:['fresh-paint','furnish']}])
  assert.deepEqual(groups.map(row=>row.type), ['fresh-paint','combination:fresh-paint,furnish'])
})
