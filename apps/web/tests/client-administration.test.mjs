import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import path from 'node:path'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(new URL('..', import.meta.url).pathname)
const documents = new Map()
const modules = new Map()
let signedToken = null
let deniedAdmin = null
const response = { json: (body, options) => ({ body, status: options?.status ?? 200 }), redirect: url => ({ location: url.href }), next: () => ({ allowed: true }) }
const mocks = {
  'next/server': { NextResponse: response },
  'next-auth/jwt': { getToken: async () => signedToken },
  '@/lib/server/superadmin-api-auth': { requireSuperadmin: async () => deniedAdmin },
  '@/lib/server/runtime-paths': { getRuntimeDataFile: name => name },
  '@/lib/server/postgres-json-store': {
    readJsonStore: async options => {
      const value = structuredClone(documents.get(options.key) ?? options.fallback)
      return options.normalize ? options.normalize(value) : value
    },
    writeJsonStore: async (options, value) => { documents.set(options.key, structuredClone(value)) },
    withJsonStoreLock: async (_key, _path, mutation) => mutation(),
  },
}
async function load(relative) {
  const file = path.resolve(root, relative)
  if (modules.has(file)) return modules.get(file)
  const exports = {}
  modules.set(file, exports)
  const source = await readFile(file, 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const imports = [...source.matchAll(/from ["']([^"']+)["']/g)].map(match => match[1])
  const dependencies = new Map()
  for (const name of imports) {
    if (mocks[name]) dependencies.set(name, mocks[name])
    else if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(file), name)
      const canonical = "@/" + path.relative(root, target)
      if (mocks[canonical]) { dependencies.set(name, mocks[canonical]); continue }
      // Type-only imports disappear from emitted code.
      if (code.includes(`require("${name}")`)) dependencies.set(name, await load(path.relative(root, `${target}.ts`)))
    }
  }
  runInNewContext(code, { exports, require: name => dependencies.get(name) ?? require(name), process: { env: {}, pid: process.pid }, crypto: globalThis.crypto, Buffer, structuredClone, URL, Headers, setTimeout, clearTimeout })
  return exports
}
const tenants = await load('lib/server/tenants-store.ts')
const auth = await load('lib/server/auth-users-store.ts')
const billing = await load('lib/server/billing-store.ts')
const ledger = await load('lib/server/token-ledger-store.ts')
const niches = await load('lib/server/tenant-niches-store.ts')
const password = 'Synthetic-Test-Only-123!'
let tenant, owner

test('customer creation creates an administrator; custom contract persists without crediting balance', async () => {
  const route = await load('app/api/superadmin/tenants/route.ts')
  const result = await route.POST({ json: async () => ({ name: 'Synthetic customer', slug: 'synthetic', contactEmail: 'owner@example.invalid', status: 'active', planCode: 'custom', businessVertical: 'real-estate', customPlan: { priceCents: 12345, tokensIncluded: 321 }, initialUserPassword: password, initialUserPasswordConfirmation: password }) })
  assert.equal(result.status, 201)
  tenant = result.body
  assert.equal(tenant.customPlan.priceCents, 12345)
  owner = (await auth.listStoredAuthUsersForTenant(tenant.slug))[0]
  assert.ok(owner.roles.includes('tenant_admin'))
  assert.ok(await auth.authenticateStoredUser(owner.email, password))
  const snapshot = await ledger.getTenantTokenSnapshot(tenant.slug)
  assert.equal(snapshot.account.includedTokens, 321)
  assert.equal(snapshot.account.balance, 0)
  await assert.rejects(tenants.updateTenant(tenant.id, { customPlan: { priceCents: -1, tokensIncluded: 1 } }), /inteiros/)
})
test('team roles refresh on existing sessions, and the final active admin cannot be removed', async () => {
  const team = [{ id: owner.id, name: owner.name, email: owner.email, role: 'admin', status: 'active' }, { name: 'Reader', email: 'reader@example.invalid', role: 'viewer', status: 'active', password }]
  const users = await auth.syncStoredTenantUsers({ tenantId: tenant.id, tenantSlug: tenant.slug, members: team })
  const reader = users.find(user => user.email === 'reader@example.invalid')
  signedToken = { sub: reader.id, tenantSlug: tenant.slug, tenantId: tenant.id, roles: ['tenant_admin'], exp: Date.now()/1000 + 1000 }
  const { getCurrentTenantToken } = await load('lib/server/current-tenant-token.ts')
  assert.ok((await getCurrentTenantToken({})).roles.includes('tenant_viewer'))
  await assert.rejects(auth.syncStoredTenantUsers({ tenantId: tenant.id, tenantSlug: tenant.slug, members: [{ ...team[0], role: 'operator' }, team[1]] }), /administrador ativo/)
  await auth.syncStoredTenantUsers({ tenantId: tenant.id, tenantSlug: tenant.slug, members: [team[0], { ...team[1], id: reader.id, status: 'disabled' }] })
  assert.equal(await getCurrentTenantToken({}), null)
})
test('status blocks login and current sessions; viewers cannot mutate tenant APIs', async () => {
  const { default: middleware } = await load('middleware.ts')
  const request = method => ({ method, nextUrl: new URL(`http://127.0.0.1:3000/api/tenant/${tenant.slug}/contacts`), url: `http://127.0.0.1:3000/api/tenant/${tenant.slug}/contacts`, headers: new Headers({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }) })
  signedToken = { sub: owner.id, tenantSlug: tenant.slug, tenantId: tenant.id, roles: ['tenant_admin'], exp: Date.now()/1000 + 1000 }
  assert.equal((await middleware(request('GET'))).allowed, true)
  await tenants.updateTenant(tenant.id, { status: 'suspended' })
  assert.equal(await auth.authenticateStoredUser(owner.email, password), null)
  assert.equal((await middleware(request('GET'))).status, 403)
  await tenants.updateTenant(tenant.id, { status: 'active' })
  const reader = (await auth.listStoredAuthUsersForTenant(tenant.slug)).find(user => user.email === 'reader@example.invalid')
  await auth.syncStoredTenantUsers({ tenantId: tenant.id, tenantSlug: tenant.slug, members: [{ id: owner.id, name: owner.name, email: owner.email, role: 'admin', status: 'active' }, { id: reader.id, name: reader.name, email: reader.email, role: 'viewer', status: 'active' }] })
  signedToken = { ...signedToken, sub: reader.id }
  assert.equal((await middleware(request('GET'))).allowed, true)
  assert.equal((await middleware(request('POST'))).status, 403)
})
test('niches can be registered and renamed; unknown niches are rejected', async () => {
  await niches.saveTenantNiche({ code: 'architecture', label: 'Arquitetura' })
  await niches.saveTenantNiche({ code: 'architecture', label: 'Arquitetura e interiores' })
  assert.equal((await niches.listTenantNiches()).filter(niche => niche.code === 'architecture').length, 1)
  assert.equal((await tenants.updateTenant(tenant.id, { businessVertical: 'architecture' })).businessVertical, 'architecture')
  await assert.rejects(tenants.updateTenant(tenant.id, { businessVertical: 'unknown' }), /Nicho não cadastrado/)
})
test('checkout uses the customer contract; global plans remain unchanged; manual credit endpoint is blocked', async () => {
  const catalog = { custom: { planCode: 'custom', enabled: true, productName: 'Custom', priceCents: 999, tokensIncluded: 10, cycle: 'MONTHLY' } }
  const stripe = { enabled: true, secretKey: 'synthetic-only', plans: { custom: { enabled: true } } }
  const plan = billing.getConfiguredStripePlan(stripe, catalog, 'custom', tenant)
  assert.equal(plan.priceCents, 12345); assert.equal(plan.tokensIncluded, 321)
  assert.equal(catalog.custom.priceCents, 999)
  const tokenRoute = await load('app/api/superadmin/tenants/[id]/billing/tokens/route.ts')
  assert.equal((await tokenRoute.POST()).status, 403)
  deniedAdmin = { status: 401 }
  assert.equal((await tokenRoute.GET({}, { params: Promise.resolve({ id: tenant.id }) })).status, 401)
  deniedAdmin = null
})
test('both checkout routes provision the negotiated amount and persist the purchased token quota', async () => {
  await billing.updatePlanCatalog({ custom: { enabled: true, priceCents: 9900, tokensIncluded: 10 } })
  await billing.updateStripeSettings({ enabled: true, secretKey: 'synthetic-only', plans: { custom: { planCode: 'custom', enabled: true } } })
  await billing.updateAbacatePaySettings({ enabled: true, apiKey: 'synthetic-only', plans: { custom: { planCode: 'custom', enabled: true, productExternalId: 'synthetic' } } })
  const calls = []
  mocks['@/lib/server/commercial-benefits-store'] = { attachReferralToTenant: async () => undefined }
  mocks['@/lib/server/stripe-client'] = {
    createStripeProductAndPrice: async (_settings, plan) => { calls.push(plan); return { productId: 'prod-synthetic', priceId: 'price-synthetic' } },
    createStripeCustomer: async () => ({ id: 'customer-synthetic' }),
    createStripeSubscriptionCheckout: async () => ({ checkoutId: 'checkout-stripe', checkoutUrl: 'https://example.invalid/stripe' }),
  }
  mocks['@/lib/server/abacatepay-client'] = {
    createAbacatePayProduct: async (_settings, plan) => { calls.push(plan); return { productId: 'prod-abacate-synthetic' } },
    createAbacatePayCustomer: async () => ({ customerId: 'customer-synthetic' }),
    createAbacatePaySubscriptionCheckout: async () => ({ checkoutId: 'checkout-abacate', checkoutUrl: 'https://example.invalid/abacate' }),
  }
  for (const provider of ['stripe', 'abacatepay']) {
    const route = await load(`app/api/superadmin/tenants/[id]/billing/${provider}/route.ts`)
    const result = await route.POST({ url: 'http://127.0.0.1:3000/checkout', json: async () => ({ planCode: 'custom' }) }, { params: Promise.resolve({ id: tenant.id }) })
    assert.equal(result.status, 200, JSON.stringify(result.body))
    assert.equal(result.body.subscription.amountCents, 12345)
    assert.equal(result.body.subscription.tokensIncluded, 321)
  }
  assert.equal(calls.length, 2)
  assert.ok(calls.every(plan => plan.priceCents === 12345 && plan.tokensIncluded === 321))
  assert.equal((await ledger.getTenantTokenSnapshot(tenant.slug)).account.balance, 0)
})
test('legacy company without an admin repairs its principal account without promoting other team members', async () => {
  const legacy = await tenants.createTenant({ name: 'Legacy test', slug: 'legacy', contactEmail: 'legacy@example.invalid', status: 'active' })
  await auth.createStoredAuthUser({ name: 'Legacy owner', email: legacy.contactEmail, password, tenantId: legacy.id, tenantSlug: legacy.slug, roles: ['tenant', 'tenant_operator'] })
  const users = await auth.listStoredAuthUsersForTenant(legacy.slug)
  assert.ok(users[0].roles.includes('tenant_admin'))
  const reader = (await auth.listStoredAuthUsersForTenant(tenant.slug)).find(user => user.email === 'reader@example.invalid')
  assert.ok(reader.roles.includes('tenant_viewer'))
})

test('gateway product endpoints persist returned IDs and reuse saved links on retry', async () => {
  for (const provider of ['stripe', 'abacatepay']) {
    const route = await load(`app/api/superadmin/billing/${provider}/products/route.ts`)
    const request = { url: 'http://127.0.0.1:3000/products', json: async () => ({ planCode: 'custom' }) }
    const first = await route.POST(request)
    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.ok(first.body.productId)
    const second = await route.POST(request)
    assert.equal(second.body.productId, first.body.productId)
    if (provider === 'stripe') assert.equal(second.body.priceId, first.body.priceId)
  }
})
test('saving the plan automatically creates both links and resumes without recreating a successful gateway', async () => {
  const source = await readFile(path.join(root, 'components/superadmin-billing-page.tsx'), 'utf8')
  const start = source.indexOf('  async function savePlanDraft()')
  const end = source.indexOf('  useEffect(', start)
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const context = {
    planDraft: { planCode: 'new-plan', productName: 'New plan', description: '', enabled: true, priceCents: 1200, tokensIncluded: 50, cycle: 'MONTHLY', quotas: {}, abacatePayEnabled: true, stripeEnabled: true, abacatePayProductId: '', stripeProductId: '', stripePriceId: '' },
    planCatalog: [], isSaving: false,
    settings: { enabled: true, apiKeyConfigured: true, plans: {} },
    stripeSettings: { enabled: true, secretKeyConfigured: true, plans: {} },
    error: null, notice: null, crypto: globalThis.crypto,
  }
  for (const [setter, key] of Object.entries({ setPlanDraft: 'planDraft', setPlanCatalog: 'planCatalog', setIsSaving: 'isSaving', setSettings: 'settings', setStripeSettings: 'stripeSettings', setError: 'error', setNotice: 'notice' })) {
    context[setter] = value => { context[key] = typeof value === 'function' ? value(context[key]) : value }
  }
  context.setPlanLimits = () => {}
  const calls = []
  let stripeFailed = false
  context.requestJson = async (url, options) => {
    const body = JSON.parse(options.body)
    if (url.endsWith('/plans')) return body.plans ?? body
    if (url.endsWith('/channel-plan-limits')) return body.plans
    if (url.endsWith('/products')) {
      calls.push(url)
      if (url.includes('/stripe/') && !stripeFailed) { stripeFailed = true; throw new Error('synthetic gateway failure') }
      const key = url.includes('/stripe/') ? 'stripeSettings' : 'settings'
      const link = { ...context[key].plans['new-plan'], productId: 'synthetic-product', ...(key === 'stripeSettings' ? { priceId: 'synthetic-price' } : {}) }
      return { productId: link.productId, priceId: link.priceId, settings: { ...context[key], plans: { 'new-plan': link } } }
    }
    return body
  }
  runInNewContext(code + '\nthis.save = savePlanDraft', context)
  await context.save()
  assert.match(context.error, /dados já salvos/)
  assert.equal(context.planDraft.abacatePayProductId, 'synthetic-product')
  await context.save()
  assert.equal(context.planDraft, null)
  assert.equal(calls.filter(url => url.includes('/abacatepay/')).length, 1)
  assert.equal(calls.filter(url => url.includes('/stripe/')).length, 2)
  assert.equal(context.stripeSettings.plans['new-plan'].priceId, 'synthetic-price')
})

test('external identity sessions remain valid without a local account while deleted local sessions are refused', async () => {
  const tokens = await load('lib/server/current-tenant-token.ts')
  signedToken = { sub: 'external-synthetic', tenantSlug: tenant.slug, authProvider: 'zitadel', roles: ['tenant'] }
  assert.ok(await tokens.getCurrentTenantToken({}))
  signedToken = { sub: 'deleted-local-synthetic', tenantSlug: tenant.slug, roles: ['tenant'] }
  assert.equal(await tokens.getCurrentTenantToken({}), null)
  signedToken = null
})
