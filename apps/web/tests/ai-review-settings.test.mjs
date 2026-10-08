import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {runInNewContext} from 'node:vm'
const require=createRequire(new URL('../package.json',import.meta.url))
const ts=require('typescript')
async function load(file,resolve){const source=await readFile(new URL(file,import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};runInNewContext(code,{exports,require:resolve,crypto:globalThis.crypto});return exports}

test('review model and opt-out persist through the actual profile endpoint; unauthorized writes are blocked',async()=>{
  let profiles=[],denied=null,writes=0
  const store=await load('../lib/server/ai-model-profiles-store.ts',name=>name.endsWith('postgres-json-store')?{readJsonStore:async()=>profiles,writeJsonStore:async(_,value)=>{profiles=value;writes++}}:name.endsWith("ai-providers-store")?{getActiveOpenRouterProvider:async()=>({id:"synthetic"})}:name.endsWith("openrouter-client")?{validateOpenRouterProfile:async()=>{}}:{getRuntimeDataFile:()=> 'synthetic'})
  profiles=await store.readAiModelProfiles()
  const selected=profiles.find(profile=>profile.purpose==='composition_review')
  assert.equal(selected.enabled,true)
  assert.equal(selected.maxCompositionAttempts,3)
  assert.equal(selected.modelId,'openai/gpt-5.4')
  const route=await load('../app/api/superadmin/ai/profiles/[id]/route.ts',name=>name==='next/server'?{NextResponse:{json:(body,opts)=>({body,status:opts?.status??200})}}:name.endsWith('superadmin-api-auth')?{requireSuperadmin:async()=>denied}:store)
  const ctx={params:Promise.resolve({id:selected.id})}
  const input={json:async()=>({modelId:'chosen/vision',enabled:false,maxCompositionAttempts:1})}
  denied={status:403}
  assert.equal((await route.PATCH(input,ctx)).status,403)
  assert.equal(writes,0)
  denied=null
  const result=await route.PATCH(input,ctx)
  assert.equal(result.status,200)
  assert.equal((await store.readAiModelProfiles()).find(p=>p.id===selected.id).enabled,false)
  assert.equal(profiles.find(p=>p.id===selected.id).modelId,'chosen/vision')
  await route.PATCH({json:async()=>({enabled:true})},ctx)
  assert.equal(profiles.find(p=>p.id===selected.id).enabled,true)
  assert.equal(profiles.find(p=>p.id===selected.id).modelId,'chosen/vision')
  assert.equal(profiles.find(p=>p.id===selected.id).maxCompositionAttempts,1)
  for (const maxCompositionAttempts of [0,4,1.5,'1',null]) {
    const before=writes
    assert.equal((await route.PATCH({json:async()=>({maxCompositionAttempts})},ctx)).status,400)
    assert.equal(writes,before)
    assert.equal(profiles.find(p=>p.id===selected.id).maxCompositionAttempts,1)
  }
  await route.PATCH({json:async()=>({maxCompositionAttempts:2})},ctx)
  assert.equal(profiles.find(p=>p.id===selected.id).maxCompositionAttempts,2)
})
