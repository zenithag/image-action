import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { webcrypto } from 'node:crypto'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript')
const sharp = require('sharp')
async function load(file, dependencies = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
  const exports = {}
  runInNewContext(outputText, { exports, Buffer, URL, crypto: webcrypto, require: name => dependencies[name] ?? require(name) })
  return exports
}
const normalization = await load('../lib/server/image-normalization.ts')
const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#458a96' } }).png().toBuffer()
const png = `data:image/png;base64,${source.toString('base64')}`

test('create, edit and CSV import persist WebP; invalid bytes never commit', async () => {
  let data = { items: [] }, writes = 0
  const store = await load('../lib/server/catalog-store.ts', {
    '@/lib/server/runtime-paths': { getRuntimeDataFile: name => name },
    '@/lib/server/image-normalization': normalization,
    '@/lib/server/postgres-json-store': {
      readJsonStore: async () => structuredClone(data),
      writeJsonStore: async (_, next) => { data = structuredClone(next); writes++ },
    },
  })
  const input = { name: 'Amostra', category: 'Tintas', imageUrl: png }
  const first = await store.createCatalogItem('one', input)
  const updated = await store.updateCatalogItem('one', first.id, { imageUrl: png })
  const imported = await store.importCatalogItems('two', [input, input])
  for (const item of [first, updated, ...imported]) {
    assert.ok(item.imageUrl.startsWith('data:image/webp;base64,'))
    assert.equal((await sharp(Buffer.from(item.imageUrl.split(',')[1], 'base64')).metadata()).format, 'webp')
  }
  await assert.rejects(store.importCatalogItems('one', [input, { ...input, imageUrl: 'data:image/png;base64,aW52YWxpZA==' }]))
  assert.equal(writes, 3)
  assert.equal(data.items.length, 3)
  assert.equal(data.items.find(item => item.id === first.id).tenantSlug, 'one')
})

test('preview lists omit embedded images; thumbnails are bounded WebP and full references retain resolution', async () => {
  const items = [{ id: 'sample', tenantSlug: 'one', imageUrl: png, tags: {}, updatedAt: 'today' }]
  let catalogEnabled = true
  const deps = { '@/lib/server/tenant-catalog-access': { getTenantCatalogAccess: async slug => ({ included: slug === 'one', enabled: catalogEnabled && slug === 'one' }), requireTenantCatalogAccess: async () => null }, '@/lib/server/catalog-store': { listCatalogItems: async slug => items.filter(item => item.tenantSlug === slug) }, '@/lib/server/image-normalization': normalization,
    '@/lib/server/catalog-reference-image': { getCatalogReferenceImageUrl: item => item.imageUrl } }
  const list = await load('../app/api/tenant/[slug]/catalog/items/route.ts', deps)
  const preview = await (await list.GET(new Request('https://app.test/api/tenant/one/catalog/items?view=preview'), { params: Promise.resolve({ slug: 'one' }) })).json()
  assert.equal(preview[0].imageUrl, 'https://app.test/api/tenant/one/catalog/items/sample/image')
  assert.ok(JSON.stringify(preview).length < source.length)
  const image = await load('../app/api/tenant/[slug]/catalog/items/[id]/image/route.ts', deps)
  const context = { params: Promise.resolve({ slug: 'one', id: 'sample' }) }
  const response = await image.GET(new Request('https://app.test/image?width=160'), context)
  assert.equal(response.headers.get('content-type'), 'image/webp')
  const bytes = Buffer.from(await response.arrayBuffer())
  const metadata = await sharp(bytes).metadata()
  assert.equal(metadata.width, 160); assert.equal(metadata.height, 120)
  assert.ok(bytes.length < source.length)
  assert.equal((await image.GET(new Request('https://app.test/image?width=9999'), context)).status, 400)
  assert.equal((await image.GET(new Request('https://app.test/image'), { params: Promise.resolve({ slug: 'other', id: 'sample' }) })).status, 404)
  const full = await image.GET(new Request('https://app.test/image'), context)
  assert.equal((await sharp(Buffer.from(await full.arrayBuffer())).metadata()).width, 800)
  catalogEnabled = false
  assert.equal((await image.GET(new Request('https://app.test/image'), context)).status, 404)
})
