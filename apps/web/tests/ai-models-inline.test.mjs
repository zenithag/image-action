import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
const require = createRequire(new URL('../package.json', import.meta.url))
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server')

test('each profile renders all editable controls inline without disclosure, preserves model validation and uses the full available width', async () => {
  const profiles = ['conversation','image_generation','classification','composition_review','vision','image_prompt'].map(purpose=>({id:purpose,name:purpose,purpose,modelId:purpose==='image_generation'?'image/model':'text/model',fallbackModelIds:[],temperature:0.4,maxTokens:1200,enabled:true,notes:''}))
  const models = [{id:'text/model',name:'Text model',inputModalities:['image','text'],outputModalities:['text'],promptPrice:'0.000001',completionPrice:'0.000002'},{id:'image/model',name:'Image model',inputModalities:['image','text'],outputModalities:['image'],imageEndpoint:true,imagePricing:[{billable:'output_image',unit:'image',cost_usd:0.05}]}]
  const guardrails = [{id:'test',label:'Regra sintética',description:'Descrição da regra',enabled:true}]
  const typesSource = await readFile(new URL('../lib/ai-types.ts', import.meta.url),'utf8')
  const types = {}
  runInNewContext(ts.transpileModule(typesSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:types})
  let state = 0
  const hooks = {...React,useState:initial=>{const index=state++;return [index===2?profiles:index===3?models:index===4?guardrails:index===6?false:index===15?{rate:5,date:'08/10/2026'}:initial,()=>{}]},useEffect:()=>{},useRef:()=>({current:null}),useMemo:fn=>fn()}
  const button = ({asChild,children,...props})=>asChild?React.cloneElement(children,props):React.createElement('button',props,children)
  const fragment = ({children})=>children
  const exports = {}
  const source = await readFile(new URL('../app/superadmin/ai/page.tsx', import.meta.url),'utf8')
  runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,require:name=>name==='react'?hooks:name==='react/jsx-runtime'?require(name):name==='radix-ui'?{Dialog:{Root:fragment,Trigger:fragment,Portal:()=>null}}:name.endsWith('ai-types')?types:name.endsWith('utils')?{cn:(...args)=>args.filter(Boolean).join(' ')}:name.endsWith('/button')?{Button:button}:name.endsWith('/fields')?{Input:'input',Textarea:'textarea'}:name.endsWith('user-menu')?{UserMenu:()=>null}:new Proxy({}, {get:()=>()=>null}),
  })
  const html = renderToStaticMarkup(exports.default())
  assert.ok(!html.includes('<details') && !html.includes('<summary'))
  assert.ok(!html.includes('max-w-6xl'))
  for (const label of ['Leitura da imagem','Preparação do prompt','Geração da composição','Avaliação de composição','Interpretação da conversa','Atendimento']) {
    for (const control of ['Modelo','Temperatura','Tokens','Ativar','Salvar']) assert.ok(html.includes(`aria-label="${control} — ${label}"`),`${control} is present for ${label}`)
  }
  assert.equal((html.match(/<select /g)||[]).length,profiles.length)
  const section = html.slice(html.indexOf('<tbody'),html.indexOf('</tbody>'))
  assert.ok(section.indexOf('Leitura da imagem') < section.indexOf('Geração da composição'))
  assert.match(html,/aria-label="Ativar — Avaliação de composição"[^>]*checked=""/)
  assert.match(html,/Mesmo modelo/)
  assert.ok(!html.includes('API key'))
  const generationSelect = html.match(/<select aria-label="Modelo — Geração da composição"[^>]*>(.*?)<\/select>/s)[1]
  assert.ok(generationSelect.includes('image/model') && !generationSelect.includes('text/model'))
  assert.match(generationSelect, /Saída: US\$.*R\$.*por imagem/)
  assert.match(html, /dólar venda BCB de 08\/10\/2026/)
  assert.match(html, /sm:flex-row sm:items-center sm:gap-4/)
  assert.match(html, /Regra sintética/)
})
