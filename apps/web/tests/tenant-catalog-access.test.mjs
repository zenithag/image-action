import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../lib/server/tenant-catalog-access.ts', import.meta.url), 'utf8')
let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const accessSource = await readFile(new URL('../lib/server/studio-surface-access.ts', import.meta.url), 'utf8')
compiled = compiled.replace('"./studio-surface-access"', JSON.stringify(moduleUrl(ts.transpileModule(accessSource, {compilerOptions: {module: ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText)))
for (const [path, code] of Object.entries({
 'next/server': 'export const NextResponse={json:(body,init)=>({body,status:init?.status||200})}',
 'next-auth/jwt': 'export const getToken=async()=>globalThis.catalogFixture.token',
 './tenants-store': 'export const findTenant=async()=>globalThis.catalogFixture.tenant',
 './tenant-settings-store': 'export const getTenantSettings=async()=>globalThis.catalogFixture.settings',
 './channel-plan-limits-store': 'export const getChannelPlanLimitMap=async()=>globalThis.catalogFixture.plans',
})) compiled = compiled.replace(JSON.stringify(path), JSON.stringify(moduleUrl(code)))
const {getTenantCatalogAccess, requireTenantCatalogAccess} = await import(moduleUrl(compiled))
const fixture = () => ({ tenant: {id:'t1',slug:'test',status:'active',planCode:'starter'}, settings:{studio:{catalogEnabled:true}}, plans:{starter:{catalogIncluded:false}}, token:{sub:'u1',exp:Date.now()/1000+60,roles:['tenant_admin'],tenantSlug:'test',tenantId:'t1'} })
const request = {nextUrl:{protocol:'http:'},url:'http://127.0.0.1:3000/api/catalog', headers:new Headers({host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'})}
test('plan entitlement and explicit tenant opt-in are both required; old plans default denied', async()=>{
 globalThis.catalogFixture=fixture()
 assert.deepEqual(await getTenantCatalogAccess('test'),{included:false,enabled:false})
 globalThis.catalogFixture.plans.starter.catalogIncluded=true
 assert.deepEqual(await getTenantCatalogAccess('test'),{included:true,enabled:true})
 globalThis.catalogFixture.settings.studio.catalogEnabled=false
 assert.deepEqual(await getTenantCatalogAccess('test'),{included:true,enabled:false})
 assert.equal((await requireTenantCatalogAccess(request,'test')).status,403)
})
test('catalog auth isolates tenants and rejects foreign origins for writes',async()=>{
 globalThis.catalogFixture=fixture();globalThis.catalogFixture.plans.starter.catalogIncluded=true
 assert.equal(await requireTenantCatalogAccess(request,'test',true),null)
 globalThis.catalogFixture.token.tenantSlug='other'
 assert.equal((await requireTenantCatalogAccess(request,'test')).status,403)
 globalThis.catalogFixture.token=null
 assert.equal((await requireTenantCatalogAccess(request,'test')).status,401)
 globalThis.catalogFixture.token=fixture().token
 assert.equal((await requireTenantCatalogAccess({...request,headers:new Headers({host:'127.0.0.1:3000',origin:'https://unrelated.example'})},'test',true)).status,403)
})
