import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require=createRequire(new URL('../package.json',import.meta.url)), ts=require('typescript')
async function load(file) { const source=await readFile(new URL(file,import.meta.url),'utf8'); const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText; return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')) }
const logic=await load('../lib/studio-surfaces.ts'), {checkStudioSurfaceAccess,checkStudioRequestOrigin}=await load('../lib/server/studio-surface-access.ts')
const polygon='<polygon>(100,100) (200,100) (200,200) (100,200)</polygon>'
const markup=`<collection mention="wall-1" asset_idx="0">${polygon}<polygon>(300,100) (400,100) (400,200) (300,200)</polygon></collection><polygon mention="floor-1">(0,500) (1000,500) (1000,1000) (0,1000) (0,500)</polygon>`
const analysis={version:1,imageHash:'a'.repeat(64),width:1000,height:500,model:'test',...logic.parseSurfaceAnnotations(markup),warnings:[],elapsedMs:10,usage:{promptTokens:1,completionTokens:1,costUsd:0,costSource:'reported'},analyzedAt:'now'}
test('native collections preserve disconnected regions of one surface; normalize and remove closing vertex',()=>{
 assert.equal(analysis.surfaces.length,2); assert.equal(analysis.surfaces[0].contours.length,2); assert.deepEqual(analysis.surfaces[0].contours[0][0],[.1,.1]); assert.equal(analysis.surfaces[1].contours[0].length,4); assert.equal(analysis.surfaces[0].confidence,undefined)
})
test('reject boxes, out-of-range, another asset, repeated points and self-intersections without fake fallback',()=>{
 const invalid='<point_box mention="wall-1">(0,0) (1000,1000)</point_box><polygon mention="wall-1">(0,0) (1001,0) (0,1000)</polygon><polygon mention="wall-2" asset_idx="1">(0,0) (100,0) (0,100)</polygon><polygon mention="wall-3">(0,0) (1000,1000) (0,1000) (1000,0)</polygon>'
 const result=logic.parseSurfaceAnnotations(invalid); assert.equal(result.surfaces.length,0); assert.equal(result.warnings.length,4)
 assert.throws(()=>logic.parseSurfaceAnnotations('<collection mention="wall-1">'+polygon),/incompleta/)
 assert.throws(()=>logic.validateSurfaceContour([[0,0],[1,0],[0,0],[0,1]]),/repetidos/)
 assert.deepEqual(logic.parseSurfaceAnnotations('There is a wall.').surfaces,[])
})
test('letterbox coordinates match object-fit contain for wide and tall canvases',()=>{
 assert.deepEqual(logic.getContainedImageRect(800,800,1000,500),{left:0,top:200,width:800,height:400})
 assert.deepEqual(logic.getContainedImageRect(800,400,400,800),{left:300,top:0,width:200,height:400})
 assert.equal(logic.getContainedImageRect(0,400,1000,500).width,0)
})
test('selection toggles and persists per image; image/result or tenant switch never reuses old contours',()=>{
 const first={surfaceAnalysis:{...analysis,sourceKey:'image-a',tenantSlug:'teste'},selectedSurfaceIds:logic.toggleSurfaceSelection([],'wall-1'),surfaceMaterialId:'paint-a'}, second={surfaceAnalysis:{...analysis,sourceKey:'image-b',tenantSlug:'teste'},selectedSurfaceIds:[]}
 const draft=structuredClone({baseImages:[first,second]}); assert.deepEqual(draft.baseImages[0].selectedSurfaceIds,['wall-1']); assert.deepEqual(draft.baseImages[1].selectedSurfaceIds,[])
 assert.equal(logic.getCurrentSurfaceAnalysis(first.surfaceAnalysis,'image-a','teste'),first.surfaceAnalysis)
 assert.equal(logic.getCurrentSurfaceAnalysis(first.surfaceAnalysis,'image-b','teste'),undefined)
 assert.equal(logic.getCurrentSurfaceAnalysis(first.surfaceAnalysis,'image-a','other'),undefined)
 assert.equal(logic.getCurrentSurfaceAnalysis({...first.surfaceAnalysis,surfaces:[{id:'invalid'}]},'image-a','teste'),undefined)
 assert.deepEqual(logic.toggleSurfaceSelection(first.selectedSurfaceIds,'wall-1'),[])
})
test('signed session must match tenant and expiry including local session timeout',()=>{
 const tenant={slug:'teste',id:'tenant-id',status:'active'}, token={sub:'user-id',tenantId:'tenant-id',tenantSlug:'teste',roles:['operator'],exp:2000,iat:1000,sessionTimeoutMinutes:10}
 assert.equal(checkStudioSurfaceAccess(token,'teste',tenant,1100),null)
 assert.equal(checkStudioSurfaceAccess(null,'teste',tenant,1100),401)
 assert.equal(checkStudioSurfaceAccess(token,'other',tenant,1100),403)
 assert.equal(checkStudioSurfaceAccess({...token,tenantId:'other'},'teste',tenant,1100),403)
 assert.equal(checkStudioSurfaceAccess(token,'teste',tenant,1601),401)
 assert.equal(checkStudioSurfaceAccess({...token,roles:['superadmin']},'teste',tenant,1100),403)
 assert.equal(checkStudioSurfaceAccess(token,'teste',{...tenant,status:'suspended'},1100),403)
})
test('server reuses recognition, deduplicates concurrent same-image requests and isolates tenant cache (mock provider)',async()=>{
 const sharp=require('sharp'), bytes=await sharp({create:{width:10,height:20,channels:3,background:'#fff'}}).png().toBuffer()
 const stores=new Map(); let calls=0; const warnings=[]
 const code=ts.transpileModule(await readFile(new URL('../lib/server/studio-surface-analysis.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 const exports={}; const mocks={
 '@/lib/studio-surfaces':logic,
 '@/lib/server/ai-providers-store':{getActiveOpenRouterProvider:async()=>({baseUrl:'https://example.invalid',apiKey:'synthetic'})},
 '@/lib/server/postgres-json-store':{readJsonStore:async s=>stores.get(s.key)||null,writeJsonStore:async(s,v)=>stores.set(s.key,v)},
 '@/lib/server/runtime-paths':{getRuntimeDataFile:x=>x},
 }
 runInNewContext(code,{exports,require:name=>mocks[name]||require(name),Buffer,AbortSignal,Date,Map,console:{warn:(...args)=>warnings.push(args)}})
 const fetcher=async(url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.equal(body.annotation_format,'polygon');assert.equal(body.vision_config.annotation_format,'polygon');assert.equal(body.model,'perceptron/perceptron-mk1.5');assert.match(body.messages[0].content[1].text,/approximate plane localization/);assert.match(body.messages[0].content[1].text,/3 to 8 vertices/);assert.doesNotMatch(body.messages[0].content[1].text,/Trace precise visible boundaries/);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:markup}}],usage:{prompt_tokens:100,completion_tokens:200,cost:.123}})}}
 const service=exports.recognizeStudioSurfaces
 const [a,b]=await Promise.all([service('teste',bytes,{fetcher}),service('teste',bytes,{fetcher})]);assert.equal(calls,1);assert.equal(a.imageHash,b.imageHash);assert.equal(a.usage.costUsd,.123)
 await service('teste',bytes,{fetcher});assert.equal(calls,1)
 await service('other',bytes,{fetcher});assert.equal(calls,2);assert.equal(stores.size,2)
 const otherBytes=await sharp(bytes).resize(20,20).png().toBuffer();await service('teste',otherBytes,{fetcher});assert.equal(calls,3)
 let incompleteCalls=0
 await assert.rejects(service('incomplete',bytes,{fetcher:async()=>{incompleteCalls++;return {ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'<collection unfinished'}}],usage:{prompt_tokens:10,completion_tokens:4096}})}}}),/limite de saída/)
 assert.equal(incompleteCalls,1,'never automatically retry a paid incomplete analysis')
 assert.equal(stores.size,3,'never cache or apply incomplete contours')
 assert.equal(warnings[0][1].reason,'length')
 assert.equal(warnings[0][1].completionTokens,4096)
 assert.ok(!JSON.stringify(warnings).includes('collection unfinished'))

})


test('real NextRequest loopback normalization does not reject the actual Host origin or allow cross-origin aliases', () => {
 const { NextRequest } = require('next/server')
 const request = new NextRequest('http://127.0.0.1:3000/api/tenant/teste/studio/surfaces', { headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' } })
 assert.equal(request.nextUrl.origin, 'http://localhost:3000', 'reproduces the installed NextURL normalization')
 assert.notEqual(request.headers.get('origin'), request.nextUrl.origin, 'old guard rejects same-origin transport')
 assert.equal(checkStudioRequestOrigin(request.headers.get('origin'), request.headers.get('host'), request.url), true)
 assert.equal(checkStudioRequestOrigin('http://localhost:3000', '127.0.0.1:3000', request.url), false)
 assert.equal(checkStudioRequestOrigin('http://127.0.0.1:3001', '127.0.0.1:3000', request.url), false)
 assert.equal(checkStudioRequestOrigin('https://attacker.example', '127.0.0.1:3000', request.url), false)
 assert.equal(checkStudioRequestOrigin('https://tenant.example', 'tenant.example', 'https://internal.example/api'), true)
 assert.equal(checkStudioRequestOrigin('http://tenant.example', 'tenant.example', 'https://internal.example/api'), false)
 for (const bad of ['null', 'not a URL', 'http://user:password@127.0.0.1:3000', 'http://127.0.0.1:3000/path']) assert.equal(checkStudioRequestOrigin(bad, '127.0.0.1:3000', request.url), false)
 assert.equal(checkStudioRequestOrigin('http://127.0.0.1:3000', 'attacker.example@127.0.0.1:3000', request.url), false)
 assert.equal(checkStudioRequestOrigin(null, '127.0.0.1:3000', request.url), true)
})

test('incomplete and malformed provider responses get safe diagnostics without retries or persisted contours', async () => {
 const sharp = require('sharp')
 const bytes = await sharp({ create: { width: 10, height: 20, channels: 3, background: '#fff' } }).png().toBuffer()
 const warnings = [], stores = new Map()
 const code = ts.transpileModule(await readFile(new URL('../lib/server/studio-surface-analysis.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
 const exports = {}, mocks = {
  '@/lib/studio-surfaces': logic,
  '@/lib/server/ai-providers-store': { getActiveOpenRouterProvider: async () => ({ baseUrl: 'https://example.invalid', apiKey: 'synthetic' }) },
  '@/lib/server/postgres-json-store': { readJsonStore: async s => stores.get(s.key) || null, writeJsonStore: async (s, v) => stores.set(s.key, v) },
  '@/lib/server/runtime-paths': { getRuntimeDataFile: value => value },
 }
 runInNewContext(code, { exports, require: name => mocks[name] || require(name), Buffer, AbortSignal, Date, Map, console: { warn: (...args) => warnings.push(args) } })
 const malformed = { choices: [{ finish_reason: 'stop', message: { content: '<collection mention="wall-1">' } }], usage: { prompt_tokens: 10, completion_tokens: 100 } }
 const cases = [
  { payload: malformed, expected: /contornos incompletos ou em formato inválido/, stage: 'annotations' },
  { jsonError: true, expected: /resposta ilegível/, stage: 'json' },
  { payload: null, expected: /resposta ilegível/, stage: 'json' },
  { payload: { choices: [{ finish_reason: 'stop', message: { content: '  ' } }] }, expected: /resposta vazia/, reason: 'empty' },
  { payload: { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }, expected: /filtro do provedor/, reason: 'content_filter' },
  { payload: { choices: [{ finish_reason: 'synthetic private reason', message: { content: 'synthetic private content' } }] }, expected: /não concluiu/, reason: 'missing-or-unknown' },
 ]
 for (const entry of cases) {
  let calls = 0
  const fetcher = async () => { calls++; return { ok: true, json: async () => { if (entry.jsonError) throw new SyntaxError('synthetic private response'); return entry.payload } } }
  await assert.rejects(exports.recognizeStudioSurfaces('test-diagnostics', bytes, { fetcher }), entry.expected)
  assert.equal(calls, 1, 'never automatically retry a paid failure')
  assert.equal(stores.size, 0, 'never persist incomplete or malformed recognition')
  if (entry.stage) assert.equal(warnings.at(-1)[1].stage, entry.stage)
  if (entry.reason) assert.equal(warnings.at(-1)[1].reason, entry.reason)
 }
 assert.ok(!JSON.stringify(warnings).includes('synthetic private'))
 assert.ok(!JSON.stringify(warnings).includes('collection mention'))
})


test('disabled recognition endpoint returns 410 without reading images or calling a provider', async () => {
 const { NextResponse } = require('next/server')
 const source=await readFile(new URL('../app/api/tenant/[slug]/studio/surfaces/route.ts',import.meta.url),'utf8')
 assert.doesNotMatch(source,/recognizeStudioSurfaces|getActiveOpenRouterProvider/)
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={}
 runInNewContext(code,{exports,require:name=>{assert.equal(name,'next/server');return {NextResponse}}})
 const response=await exports.POST({json:()=>{throw new Error('must not read client image')}})
 assert.equal(response.status,410)
 assert.match((await response.json()).error,/desativados/)
})
