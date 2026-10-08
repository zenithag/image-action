import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
async function load(relative) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  let compiled = outputText
  for (const file of ["catalog-color-utils", "catalog-reference-image"]) {
    const specifier = `"./server/${file}"`
    if (!compiled.includes(specifier)) continue
    const dependency = await readFile(new URL(`../lib/server/${file}.ts`, import.meta.url), "utf8")
    const code = ts.transpileModule(dependency, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    compiled = compiled.replace(specifier, `"data:text/javascript;base64,${Buffer.from(code).toString("base64")}"`)
  }
  if (compiled.includes('"./studio-surfaces"')) {
    const dependency = await readFile(new URL('../lib/studio-surfaces.ts', import.meta.url), 'utf8')
    const code = ts.transpileModule(dependency, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    compiled = compiled.replace('"./studio-surfaces"', `"data:text/javascript;base64,${Buffer.from(code).toString('base64')}"`)
  }
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
}
const { validateStudioFiles, buildStudioInput, getEnvironmentReferences, toggleStudioPreset, getStudioInstruction, buildStudioPresetsInput, STUDIO_PRESET_ORDER, buildStudioPresetInput, buildStudioCompositionInput, getStudioWorkingBase, recordStudioPresetResult, removeStudioPresetVersion, getStudioFurniture, chooseStudioFurniture, isStudioMaterialPreset, hasStudioPresetInstruction, getStudioMaterials, getStudioPaints, getStudioPaintSwatch, getStudioPaintPreviewSource, buildStudioMaterialInput, selectStudioMaterial, buildStudioPaintInput, submitStudioPaintJob, readStudioPaintJob, MAX_UPLOAD_BYTES, MAX_REQUEST_BYTES } = await load("../lib/studio-v1.ts")
const { getStudioArtifactKey, ensureStudioScenarios, planStudioScenarios, expandStudioScenarioVariations } = await load("../lib/studio-draft.ts")
const file = { type: "image/png", size: 100 }
const base = { source: "upload", mediaUrl: "data:image/webp;base64,base", createdAt: "2026-09-28" }

test("three environments with separate products create three single-reference requests", () => {
  const refs = [1, 2, 3].map(i => ({ ...base, mediaUrl: `product-${i}` }))
  const environments = refs.map((ref, i) => ({ ...base, mediaUrl: `room-${i}`, selectedReferenceUrls: [ref.mediaUrl] }))
  const requests = environments.map(room => buildStudioInput("test", room, getEnvironmentReferences(room, refs), "Aplicar produtos"))
  assert.equal(requests.length, 3)
  requests.forEach((request, i) => assert.deepEqual(request.references.map(ref => ref.imageUrl), [refs[i].mediaUrl]))
})

test("one environment with three selected products produces one request containing all three", () => {
  const refs = [1, 2, 3].map(i => ({ ...base, mediaUrl: `product-${i}` }))
  const room = { ...base, selectedReferenceUrls: refs.map(ref => ref.mediaUrl) }
  const request = buildStudioInput("test", room, getEnvironmentReferences(room, refs), "Aplicar todos juntos")
  assert.equal(request.references.length, 3)
  assert.equal(getEnvironmentReferences({ ...base, selectedReferenceUrls: [] }, refs).length, 0)
  assert.equal(getEnvironmentReferences(room, refs.slice(1)).length, 2)
})

test("accepts five references together and rejects a sixth or multiple environments", () => {
  assert.equal(validateStudioFiles(Array(5).fill(file), 0, "reference"), null)
  assert.match(validateStudioFiles([file], 5, "reference"), /5 referências/)
  assert.match(validateStudioFiles([file, file], 0, "base"), /apenas uma/)
})
test("rejects unsupported formats and oversized files before decoding", () => {
  assert.match(validateStudioFiles([{ ...file, type: "image/svg+xml" }], 0, "reference"), /JPG/)
  assert.match(validateStudioFiles([{ ...file, size: MAX_UPLOAD_BYTES + 1 }], 0, "base"), /15 MB/)
})
test("one request includes all references in order, without duplicating legacy image fields", () => {
  const refs = Array.from({ length: 5 }, (_, i) => ({ ...base, mediaUrl: `ref-${i}` }))
  const input = buildStudioInput("test", base, refs, "Ref. 1 na parede, ref. 2 no piso")
  assert.deepEqual(input.references.map(ref => ref.imageUrl), refs.map(ref => ref.mediaUrl))
  assert.equal(input.referenceImageUrl, undefined)
  assert.equal(input.baseImageUrl, base.mediaUrl)
  assert.match(input.prompt, /supplied references in order/)
})
test("requires direction and a base, supports zero references, preserves Inbox and catalog context", () => {
  assert.throws(() => buildStudioInput("test", base, [], " "))
  assert.throws(() => buildStudioInput("test", { ...base, mediaUrl: "" }, [], "pintar"))
  assert.equal(buildStudioInput("test", base, [], "Pintar de verde").references.length, 0)
  const input = buildStudioInput("test", { ...base, source: "inbox", conversationId: "chat", messageId: "msg" }, [{ ...base, source: "catalog", catalogItemId: "sku" }], "Aplicar no piso")
  assert.equal(input.conversationId, "chat")
  assert.equal(input.baseMessageId, "msg")
  assert.equal(input.references[0].catalogItemId, "sku")
})
test("different uploads sharing the same header are not confused", () => {
  const prefix = "data:image/webp;base64," + "a".repeat(100)
  assert.notEqual(getStudioArtifactKey({ ...base, mediaUrl: prefix + "b" }), getStudioArtifactKey({ ...base, mediaUrl: prefix + "c" }))
})

test("catalog numbering follows upload order and long metadata fits the API prompt limit", () => {
  const refs = [base, ...Array.from({ length: 4 }, () => ({ ...base, source: "catalog", catalogItemName: "Produto", catalogDescription: "a".repeat(5000) }))]
  const input = buildStudioInput("test", base, refs, "b".repeat(4000))
  assert.match(input.prompt, /Reference 2: Produto/)
  assert.ok(input.prompt.length <= 5000)
})

// Exercise the existing storage adapter without opening a real browser database.
test("presets combine independently per room and survive the existing draft save/load adapter", async () => {
  const { saveStudioSession, loadStudioSession } = await load("../lib/studio-v1-storage.ts")
  const previousIndexedDB = globalThis.indexedDB
  const records = new Map()
  globalThis.indexedDB = {
    open() {
      const request = {}
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction(_name, mode) {
            const transaction = {
              objectStore() {
                return {
                  put(value, key) {
                    records.set(key, structuredClone(value))
                    queueMicrotask(() => transaction.oncomplete())
                  },
                  get(key) {
                    const result = { result: structuredClone(records.get(key)) }
                    queueMicrotask(() => result.onsuccess())
                    return result
                  },
                }
              },
            }
            assert.ok(mode === undefined || mode === "readwrite")
            return transaction
          },
        }
        request.onsuccess()
      })
      return request
    },
  }
  try {
    const room = { ...base, mediaUrl: "room-a", instruction: "Pinte de azul", selectedReferenceUrls: [], presetVersions: [{ jobId: "saved-version", preset: "renovate", label: "Renovação", resultImageUrl: "saved-result", status: "done", createdAt: "today" }], selectedPresetVersionId: "saved-version", paintJobId: "saved-job-a", paintCatalogItemId: "saved-paint-a", roomType: "bedroom", propertyContexts: ["Alto padrão"], presetOptions: { "fresh-paint": { color: "#ab1234", instructions: "Fosco", reference: { ...base, mediaUrl: "data:image/webp;base64,reference" } } }, materialReferences: { "fresh-paint": { source: "catalog", mediaUrl: "saved-paint", catalogItemId: "saved-paint-a", catalogItemName: "Tinta salva", catalogCategory: "Tintas", catalogProductType: "tinta", catalogTenantSlug: "test-presets", createdAt: "2026-10-04" } }, selectedSurfaceIds: ["wall-1"], surfaceMaterialId: "saved-paint-a", surfaceAnalysis: { version: 1, sourceKey: "saved-image-key", tenantSlug: "test", imageHash: "a".repeat(64), surfaces: [{ id: "wall-1", type: "wall", state: "proposed", contours: [[[0, 0], [1, 0], [0, 1]]] }] } }
    const other = { ...base, mediaUrl: "room-b", instruction: "Mantenha o sofá" }
    const first = toggleStudioPreset(room, "fresh-paint")
    const combined = toggleStudioPreset(first, "remove-furniture")
    assert.deepEqual(combined.presetIds, ["remove-furniture", "fresh-paint"])
    assert.equal(room.presetIds, undefined)
    assert.equal(other.presetIds, undefined)
    assert.equal(combined.instruction, room.instruction)
    const scenarios = [{ baseKey: getStudioArtifactKey(other), instruction: "Cenário independente", selectedReferenceUrls: [], variationCount: 3 }]
    await saveStudioSession("test-presets", { base: combined, baseImages: [combined, other], scenarios, references: [], instruction: "Instrução geral" })
    const restored = await loadStudioSession("test-presets")
    assert.deepEqual(restored.scenarios, scenarios)
    assert.deepEqual(restored.baseImages[0].surfaceAnalysis, room.surfaceAnalysis)
    assert.deepEqual(restored.baseImages[0].selectedSurfaceIds, ["wall-1"])
    assert.equal(restored.baseImages[0].surfaceMaterialId, "saved-paint-a")
    assert.equal(restored.baseImages[1].selectedSurfaceIds, undefined)
    assert.deepEqual(restored.baseImages[0].presetVersions, room.presetVersions)
    assert.equal(restored.baseImages[0].selectedPresetVersionId, "saved-version")
    assert.equal(restored.baseImages[0].roomType, "bedroom")
    assert.deepEqual(restored.baseImages[0].propertyContexts, ["Alto padrão"])
    assert.deepEqual(restored.baseImages[0].presetOptions, room.presetOptions)
    assert.deepEqual(restored.baseImages[0].materialReferences, room.materialReferences)
    assert.deepEqual(restored.baseImages, [combined, other])
    assert.equal(restored.baseImages[0].paintJobId, "saved-job-a")
    assert.equal(restored.baseImages[0].paintCatalogItemId, "saved-paint-a")
    assert.equal(await loadStudioSession("other-tenant"), undefined)
    const request = buildStudioInput("test-presets", { ...restored.baseImages[0], selectedSurfaceIds: [] }, [], restored.instruction)
    assert.match(request.prompt, /Remove loose furniture and movable furnishings only/)
    assert.match(request.prompt, /Apply fresh, evenly finished paint/)
    assert.match(request.prompt, /Pinte de azul/)
    assert.doesNotMatch(request.prompt, /Instrução geral/)
    assert.match(request.prompt, /Preserve its exact pixel dimensions/)
    assert.equal(request.baseImageUrl, "room-a")
    assert.doesNotMatch(buildStudioInput("test-presets", restored.baseImages[1], [], "").prompt, /Remove loose furniture|Apply fresh/)
    const toggledBack = toggleStudioPreset(toggleStudioPreset(combined, "fresh-paint"), "fresh-paint")
    assert.equal(getStudioInstruction(toggledBack, ""), getStudioInstruction(combined, ""))
    assert.equal(request.prompt.split("Remove loose furniture and movable furnishings only").length - 1, 1)
    const cleared = toggleStudioPreset(toggleStudioPreset(combined, "fresh-paint"), "remove-furniture")
    assert.equal(getStudioInstruction(cleared, ""), "Pinte de azul")
  } finally {
    if (previousIndexedDB === undefined) delete globalThis.indexedDB
    else globalThis.indexedDB = previousIndexedDB
  }
})

test("presets alone provide direction and preserve unselected furniture or painting", () => {
  const removal = toggleStudioPreset(base, "remove-furniture")
  const painting = toggleStudioPreset(base, "fresh-paint")
  assert.match(buildStudioInput("test", removal, [], "").prompt, /Preserve existing paint/)
  assert.match(buildStudioInput("test", removal, [], "").prompt, /built-in furniture, counters, sinks, toilets, barbecue/)
  assert.match(buildStudioInput("test", painting, [], "").prompt, /Preserve existing furniture/)
  assert.match(buildStudioInput("test", painting, [], "").prompt, /already painted walls/)
  assert.throws(() => buildStudioInput("test", toggleStudioPreset(removal, "remove-furniture"), [], ""))
})

test("combined prompt budget reports an error instead of truncating manual instructions", () => {
  const selected = toggleStudioPreset(toggleStudioPreset(base, "remove-furniture"), "fresh-paint")
  const references = Array.from({ length: 5 }, () => ({ ...base, source: "catalog", catalogDescription: "a".repeat(5000) }))
  assert.throws(() => buildStudioInput("test", selected, references, "b".repeat(4000)), /5.000 caracteres/)
})

test("preset briefings bypass legacy surface heuristics and local color-only rendering", async () => {
  const { runInNewContext } = await import("node:vm")
  const source = await readFile(new URL("../lib/server/openrouter-image-worker.ts", import.meta.url), "utf8")
  const ast = ts.createSourceFile("worker.ts", source, ts.ScriptTarget.Latest, true)
  const functions = ast.statements.filter(statement => ts.isFunctionDeclaration(statement) && ["getRequestedSurface", "getTargetSurfaceInstruction", "isLocalizedSurfaceColorRequest"].includes(statement.name?.text))
  assert.equal(functions.length, 3)
  const { outputText } = ts.transpileModule(functions.map(fn => fn.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
  const context = {
    hasStudioPresetInstruction,
    normalizeText: value => value.toLowerCase(),
    getRequestedPaintColor: async () => "#0000ff",
  }
  runInNewContext(outputText, context)
  const selected = toggleStudioPreset(toggleStudioPreset(base, "remove-furniture"), "fresh-paint")
  const input = buildStudioInput("test", selected, [], "Pinte de azul")
  assert.equal(hasStudioPresetInstruction(input.prompt), true)
  assert.equal(context.getRequestedSurface(input), null)
  assert.equal(context.getTargetSurfaceInstruction(input), "")
  assert.equal(await context.isLocalizedSurfaceColorRequest(input), false)
  for (const id of ["renovate", "furnish", "wall-covering", "flooring", "ceiling"]) {
    const job = { prompt: getStudioInstruction({ ...base, presetIds: [id] }, "") }
    assert.equal(hasStudioPresetInstruction(job.prompt), true)
    assert.equal(context.getRequestedSurface(job), null)
    assert.equal(context.getTargetSurfaceInstruction(job), "")
    assert.equal(await context.isLocalizedSurfaceColorRequest(job), false)
  }
  const legacy = { prompt: "Pinte a parede de azul" }
  assert.equal(hasStudioPresetInstruction(legacy.prompt), false)
  assert.equal(context.getRequestedSurface(legacy), "painted_wall")
  assert.match(context.getTargetSurfaceInstruction(legacy), /todas as paredes/)
  assert.equal(await context.isLocalizedSurfaceColorRequest(legacy), true)
})

const paint = { id: "paint-a", tenantSlug: "test", name: "Azul catálogo", category: "Tintas", description: "Acabamento fosco", sku: "AZ-1", status: "active", tags: { product_type: "tinta" }, imageUrl: "catalog-image", createdAt: "2026-10-04", updatedAt: "2026-10-04" }

test("paint catalog excludes other tenants, inactive or untyped categories, and unrelated products", () => {
  assert.deepEqual(getStudioPaints([paint, { ...paint, tenantSlug: "other" }, { ...paint, status: "inactive" }, { ...paint, tags: {} }, { ...paint, tags: { product_type: "revestimento" } }], "test"), [paint])
  assert.deepEqual(getStudioPaints([], "test"), [])
  const withColor = { ...paint, tags: { product_type: "tinta", cor: "#123abc" } }
  assert.equal(getStudioPaintSwatch(withColor), "#123abc")
  assert.equal(buildStudioPaintInput("test", base, withColor, "", 72).catalogColorReference, "#123abc")
  assert.equal(getStudioPaintSwatch(paint), undefined)
  assert.throws(() => buildStudioPaintInput("other", base, paint, "", 72), /tinta ativa/)
})

test("paint confirmation snapshots retain the selected room, product and original despite a scene switch", async () => {
  const firstRoom = { ...base, mediaUrl: "room-a", instruction: "Preserve a moldura", presetIds: ["remove-furniture"] }
  const snapshot = structuredClone(firstRoom)
  const secondRoom = { ...base, mediaUrl: "room-b" }
  const input = buildStudioPaintInput("test", snapshot, paint, "instrução geral", 72)
  assert.equal(input.baseImageUrl, "room-a")
  assert.equal(input.catalogItemId, paint.id)
  assert.deepEqual(input.references.map(ref => ref.catalogItemId), [paint.id])
  assert.match(input.prompt, /selected catalog product: Azul catálogo/)
  assert.match(input.prompt, /Preserve a moldura/)
  assert.match(input.prompt, /Remove loose furniture/)
  assert.equal(firstRoom.paintJobId, undefined)
  const calls = []
  const queued = { id: "job-a", tenantSlug: "test", baseImageUrl: "room-a", status: "queued" }
  const mock = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) })
    return new Response(JSON.stringify({ job: queued }), { status: calls.length === 1 ? 201 : 200 })
  }
  const submitted = { ...input, sourceMessageId: "studio:stable-request" }
  assert.equal((await submitStudioPaintJob("test", submitted, mock)).id, "job-a")
  assert.equal((await submitStudioPaintJob("test", submitted, mock)).id, "job-a")
  assert.deepEqual(calls[0], calls[1])
  assert.equal(secondRoom.paintJobId, undefined)
  const restored = structuredClone({ ...firstRoom, paintJobId: queued.id, paintCatalogItemId: paint.id })
  assert.equal(restored.mediaUrl, "room-a")
  assert.equal(restored.paintCatalogItemId, paint.id)
  for (const status of ["queued", "processing", "done", "failed"]) {
    const result = await readStudioPaintJob("test", restored.paintJobId, undefined, async url => {
      assert.equal(url, "/api/tenant/test/compositions/jobs/job-a")
      return new Response(JSON.stringify({ ...queued, status, resultImageUrl: status === "done" ? "result-a" : undefined, errorMessage: status === "failed" ? "Falha recuperável" : undefined }))
    })
    assert.equal(result.status, status)
    if (status === "done") assert.equal(result.resultImageUrl, "result-a")
    if (status === "failed") assert.equal(result.errorMessage, "Falha recuperável")
  }
})

test("paint submission preserves API balance errors and rejects cross-tenant or wrong-job responses", async () => {
  const input = { ...buildStudioPaintInput("test", base, paint, "", 72), sourceMessageId: "studio:retryable" }
  await assert.rejects(submitStudioPaintJob("test", input, async () => new Response(JSON.stringify({ error: "Saldo insuficiente" }), { status: 402 })), /Saldo insuficiente/)
  await assert.rejects(submitStudioPaintJob("test", input, async () => new Response(JSON.stringify({ job: { id: "job-a", tenantSlug: "other" } }))), /inválida/)
  await assert.rejects(readStudioPaintJob("test", "job-a", undefined, async () => new Response(JSON.stringify({ id: "job-b", tenantSlug: "test" }))), /inválida/)
  assert.equal(input.sourceMessageId, "studio:retryable")
  assert.equal(base.paintJobId, undefined)
})

test("paint thumbnails use small cached previews, reject placeholders, and render as native images", async () => {
  const png = "data:image/png;base64,iVBORw0KGgo="
  const previewUrl = `/api/tenant/test/catalog/items/paint-a/image?width=160&v=${encodeURIComponent(paint.updatedAt)}`
  assert.equal(getStudioPaintPreviewSource({ ...paint, imageUrl: png }, "test"), previewUrl)
  assert.equal(getStudioPaintPreviewSource({ ...paint, imageUrl: png }, "other"), undefined)
  assert.equal(getStudioPaintPreviewSource({ ...paint, imageUrl: "data:image/svg+xml,placeholder" }, "test"), undefined)
  assert.equal(getStudioPaintPreviewSource({ ...paint, imageUrl: "https://example.invalid/paint.png" }, "test"), previewUrl)
  const { runInNewContext } = await import("node:vm")
  const React = require("react")
  const { renderToStaticMarkup } = require("react-dom/server")
  const source = await readFile(new URL("../components/safe-image.tsx", import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } })
  const exports = {}
  const context = { exports, require: name => name === "@/lib/utils" ? { cn: (...classes) => classes.filter(Boolean).join(" ") } : require(name) }
  runInNewContext(outputText, context)
  const html = renderToStaticMarkup(React.createElement(exports.SafeImage, { src: getStudioPaintPreviewSource({ ...paint, imageUrl: png }, "test"), alt: paint.name, className: "paint-thumbnail" }))
  assert.match(html, /<img/)
  assert.ok(html.includes(`src="${previewUrl.replaceAll("&", "&amp;")}"`))
  assert.doesNotMatch(html, /Imagem indisponivel|_next\/image|localhost/)
})

test("an already-open empty paint strip refreshes to eight paints and cleans up timers/listeners", async () => {
  const { runInNewContext } = await import("node:vm")
  const source = await readFile(new URL("../components/studio-paint-flow.tsx", import.meta.url), "utf8")
  const ast = ts.createSourceFile("paint.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let effect
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "useEffect" && node.arguments[0]?.getText(ast).includes('/catalog/items')) effect = node.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(effect)
  const { outputText } = ts.transpileModule(`var effect = ${effect.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
  let calls = 0, state = [], timer, loading = false, catalogError = null, failOnce = false
  const listeners = new Map()
  const documentListeners = new Map()
  const rows = Array.from({ length: 8 }, (_, i) => ({ ...paint, id: `paint-${i}`, imageUrl: "data:image/png;base64,aGVsbG8=" }))
  const context = {
    base, catalogActive: true, open: true, slug: "test", preset: "fresh-paint", AbortController, getStudioPaints, getStudioMaterials, isStudioMaterialPreset,
    setItems: value => { state = value }, setCatalogError: value => { catalogError = value }, setLoading: value => { loading = value },
    fetch: async (url, options) => {
      assert.equal(url, "/api/tenant/test/catalog/items?view=preview")
      assert.equal(options.cache, "no-store")
      calls++
      if (failOnce) { failOnce = false; return { ok: false, json: async () => ({ error: "Temporary failure" }) } }
      return { ok: true, json: async () => calls === 1 ? [] : [...rows, { ...paint, tags: { product_type: "revestimento" } }] }
    },
    setTimeout: (callback, delay) => { assert.equal(delay, 5000); timer = callback; return 1 }, clearTimeout: () => { timer = undefined },
    window: { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
    document: { visibilityState: "visible", addEventListener: (name, callback) => documentListeners.set(name, callback), removeEventListener: name => documentListeners.delete(name) },
  }
  runInNewContext(outputText, context)
  const cleanup = context.effect()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.length, 0)
  assert.equal(loading, false)
  assert.equal(typeof timer, "function", "a strip loaded before registration must retry while still open")
  timer()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.length, 8)
  assert.equal(calls, 2)
  assert.equal(timer, undefined, "stop empty-state polling after paints are available")
  listeners.get("focus")()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls, 3)
  failOnce = true
  listeners.get("focus")()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof catalogError, "string")
  assert.equal(typeof timer, "function", "errors must retry without an Update button")
  timer()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(catalogError, null)
  assert.equal(state.length, 8)
  assert.equal(calls, 5)
  cleanup()
  assert.equal(listeners.size, 0)
  assert.equal(documentListeners.size, 0)
})


test("experimental surface selections cannot silently submit an unmasked paint generation", () => {
  assert.throws(() => buildStudioPaintInput("test", { ...base, selectedSurfaceIds: ["wall-1"] }, paint, "", 72), /ainda não restringe/)
})


const wallMaterial = { ...paint, id: "wall-cover", name: "Porcelanato marmorizado para parede", category: "Revestimentos para parede", tags: { product_type: "revestimento", usage_mode: "catalogo" } }
const floorMaterial = { ...wallMaterial, id: "floor-material", category: "Pisos", name: "Piso de demonstração" }
const ceilingMaterial = { ...wallMaterial, id: "ceiling-material", category: "Forros", tags: { product_type: "outro", usage_mode: "catalogo" }, name: "Forro de demonstração" }

test("renovation and furnishing are job instructions; last furniture choice wins without losing manual refinements", () => {
  const room = { ...base, instruction: "Mantenha o quadro", roomType: "bedroom", propertyContexts: ["Alto padrão"] }
  const renovated = toggleStudioPreset(room, "renovate")
  assert.match(buildStudioInput("test", renovated, [], "").prompt, /Repair peeling paint, superficial plaster damage, visible cracks, grime/)
  assert.doesNotMatch(getStudioInstruction(renovated, ""), /Add furniture|Remove loose/)
  const furnished = toggleStudioPreset(toggleStudioPreset(renovated, "remove-furniture"), "furnish")
  assert.deepEqual(furnished.presetIds, ["renovate", "furnish"])
  assert.equal(furnished.instruction, room.instruction)
  const input = buildStudioInput("test", furnished, [], "")
  assert.equal(hasStudioPresetInstruction(input.prompt), true)
  assert.match(input.prompt, /appropriate to bedroom/)
  assert.match(input.prompt, /high-end/)
  assert.match(input.prompt, /Mantenha o quadro/)
  assert.doesNotMatch(input.prompt, /Remove loose furniture/)
  assert.deepEqual(toggleStudioPreset(furnished, "remove-furniture").presetIds, ["remove-furniture", "renovate"])
  const restored = toggleStudioPreset(toggleStudioPreset(furnished, "furnish"), "furnish")
  assert.equal(getStudioInstruction(restored, ""), getStudioInstruction(furnished, ""))
  assert.equal(input.prompt.split("Add furniture").length - 1, 1)
  assert.equal(hasStudioPresetInstruction("PRESETS_ESTUDIO: furnish,furnish\n"), false)
  assert.equal(hasStudioPresetInstruction("PRESETS_ESTUDIO: invented\n"), false)
})

test("material catalog uses explicit type/category; floor and wall finishes share one preset but ceiling stays separate", () => {
  const items = [paint, wallMaterial, floorMaterial, ceilingMaterial, { ...wallMaterial, id: "other", tenantSlug: "other" }, { ...wallMaterial, id: "inactive", status: "inactive" }, { ...wallMaterial, id: "reference", tags: { product_type: "revestimento", usage_mode: "referencia" } }]
  assert.deepEqual(getStudioMaterials(items, "test", "fresh-paint"), [paint])
  assert.deepEqual(getStudioMaterials(items, "test", "wall-covering"), [wallMaterial])
  assert.deepEqual(getStudioMaterials(items, "test", "flooring"), [floorMaterial])
  assert.deepEqual(getStudioMaterials(items, "test", "ceiling"), [ceilingMaterial])
  assert.deepEqual(getStudioMaterials([wallMaterial], "test", "flooring"), [])
  assert.deepEqual(getStudioMaterials([], "test", "ceiling"), [])
  assert.deepEqual(getStudioMaterials(items, "test", "flooring", "walls"), [wallMaterial])
  assert.deepEqual(getStudioMaterials(items, "test", "flooring", "both"), [])
  assert.throws(() => selectStudioMaterial("test", base, "flooring", wallMaterial), /compatível/)
  assert.equal(selectStudioMaterial("test", { ...base, presetOptions: { flooring: { surface: "walls" } } }, "flooring", wallMaterial).materialReferences.flooring.catalogItemId, wallMaterial.id)
  assert.throws(() => selectStudioMaterial("other", base, "wall-covering", wallMaterial), /compatível/)
})

test("material choices are per room, combinable across surfaces, persisted and actually included in native jobs", async () => {
  const furnished = toggleStudioPreset({ ...base, roomType: "living-room", furnishingLuxury: false }, "furnish")
  const painted = selectStudioMaterial("test", furnished, "fresh-paint", paint)
  const covered = selectStudioMaterial("test", painted, "wall-covering", wallMaterial)
  assert.equal(covered.presetIds.includes("fresh-paint"), false, "paint/wall finish alternatives use the last choice")
  let combined = selectStudioMaterial("test", covered, "flooring", floorMaterial)
  combined = selectStudioMaterial("test", combined, "ceiling", ceilingMaterial)
  const restored = structuredClone(combined)
  const input = buildStudioMaterialInput("test", restored, "wall-covering", wallMaterial, "Mantenha as portas", 61)
  assert.deepEqual(input.references.map(ref => ref.catalogItemId), [wallMaterial.id, floorMaterial.id, ceilingMaterial.id])
  assert.equal(input.baseImageUrl, base.mediaUrl)
  assert.equal(input.changeStrength, 61)
  assert.equal(input.catalogItemId, wallMaterial.id)
  assert.equal(hasStudioPresetInstruction(input.prompt), true)
  assert.match(input.prompt, /living room/)
  assert.match(input.prompt, /the visible floor/)
  assert.match(input.prompt, /Renew only the ceiling finish/)
  assert.match(input.prompt, /Mantenha as portas/)
  assert.equal(base.materialReferences, undefined)
  assert.equal(buildStudioInput("test", restored, [restored.materialReferences["wall-covering"]], "").references.length, 3, "do not duplicate chosen catalog material")
  assert.throws(() => buildStudioInput("other", restored, [], ""), /tenant/)
  assert.throws(() => buildStudioInput("test", { ...restored, selectedSurfaceIds: ["floor-1"] }, [], ""), /ainda não restringe/)
  assert.throws(() => buildStudioInput("test", restored, Array.from({length: 5}, (_, i) => ({ ...base, mediaUrl: `ref-${i}` })), ""), /5 referências/)
  const job = await submitStudioPaintJob("test", { ...input, sourceMessageId: "studio:material-test" }, async (url, request) => {
    assert.equal(url, "/api/tenant/test/compositions/jobs")
    assert.deepEqual(JSON.parse(request.body).references.map(ref => ref.catalogItemId), [wallMaterial.id, floorMaterial.id, ceilingMaterial.id])
    return new Response(JSON.stringify({job:{id:"material-job",tenantSlug:"test",status:"queued"}}))
  })
  assert.equal(job.id, "material-job")
})

test("preset actions are isolated, bind the chosen version and keep general inputs for the next composition", () => {
  const room = { ...base, instruction: "Aplicar minha referência na próxima composição", presetIds: ["fresh-paint", "furnish"], materialReferences: { "fresh-paint": { catalogItemId: "old-paint" } }, presetVersions: [{ jobId: "version-1", preset: "renovate", label: "Renovação", resultImageUrl: "/generated/renovated.webp", status: "done", createdAt: "today" }], selectedPresetVersionId: "version-1" }
  const remove = buildStudioPresetInput("test", room, "remove-furniture", { strength: 72 })
  assert.equal(remove.purpose, "studio-preset")
  assert.equal(remove.baseImageUrl, "/generated/renovated.webp")
  assert.equal(remove.baseMessageId, undefined)
  assert.equal(remove.references.length, 0)
  assert.match(remove.prompt, /^PRESETS_ESTUDIO: remove-furniture\n/)
  assert.doesNotMatch(remove.prompt, /Aplicar minha referência|old-paint|PRESETS_ESTUDIO:.*fresh-paint/)
  const composition = buildStudioCompositionInput("test", room, [{ ...base, mediaUrl: "next-reference" }], room.instruction)
  assert.equal(composition.baseImageUrl, "/generated/renovated.webp")
  assert.match(composition.prompt, /Aplicar minha referência/)
  assert.doesNotMatch(composition.prompt, /PRESETS_ESTUDIO/)
  assert.equal(composition.references[0].imageUrl, "next-reference")
  assert.equal(room.mediaUrl, base.mediaUrl)
  assert.deepEqual(room.presetIds, ["fresh-paint", "furnish"])
})

test("painting includes ceiling only by explicit choice; selecting planes requires a bound analysis", () => {
  const options = { item: paint, strength: 72 }
  const walls = buildStudioPresetInput("test", base, "fresh-paint", options)
  assert.match(walls.prompt, /keep the ceiling exactly/)
  const ceiling = buildStudioPresetInput("test", base, "fresh-paint", { ...options, includeCeiling: true })
  assert.match(ceiling.prompt, /walls and the already painted ceiling/)
  assert.throws(() => buildStudioPresetInput("test", base, "fresh-paint", { ...options, scope: "selected" }), /foi desativada/)
  assert.match(buildStudioPresetInput("test", base, "renovate", { strength: 72 }).prompt, /preserving its existing design/)
})

test("furnishing uses real tenant products and classified rooms; aggregate retains prior edits", () => {
  const furniture = { ...paint, id: "table", name: "Mesa", category: "Móveis", tags: { product_type: "movel", usage_mode: "catalogo", room_type: "kitchen" }, imageUrl: "data:image/png;base64,aGVsbG8=" }
  const rows = [furniture, { ...furniture, id: "other-tenant", tenantSlug: "other" }, { ...furniture, id: "unclassified", tags: { product_type: "movel" } }, paint]
  assert.equal(getStudioFurniture(rows, "test").length, 2)
  assert.deepEqual(chooseStudioFurniture(rows, "test", "kitchen", () => .5).map(item => item.id), ["table"])
  assert.equal(chooseStudioFurniture(rows, "test", "bedroom").length, 0)
  const room = { ...base, roomType: "kitchen", selectedPresetVersionId: "one", presetVersions: [{ jobId: "one", status: "done", resultImageUrl: "edited-room" }] }
  const input = buildStudioPresetInput("test", room, "furnish", { furniture: [furniture], strength: 72, aggregate: true, placement: "parede esquerda" })
  assert.equal(input.baseImageUrl, "edited-room")
  assert.equal(input.references[0].catalogItemId, "table")
  assert.match(input.prompt, /kitchen|parede esquerda/)
  assert.match(input.prompt, /Preserve all existing furnishings and earlier edits/)
  assert.equal(buildStudioPresetInput("test", room, "furnish", { furniture: [furniture], strength: 72, aggregate: false }).baseImageUrl, base.mediaUrl)
  assert.throws(() => buildStudioPresetInput("test", base, "furnish", { furniture: [rows[1]], strength: 72 }), /deste catálogo/)
  assert.equal(buildStudioPresetInput("test", base, "furnish", { furniture: [], strength: 72 }).references.length, 0)
})

test("polling stores versions once, preserves original, ignores other jobs and preserves a reviewed selection", () => {
  const job = { id: "new", tenantSlug: "test", status: "done", resultImageUrl: "new-result", createdAt: "today" }
  const original = { ...base, paintJobId: "new", pendingPresetId: "renovate", pendingPresetLabel: "Renovação", pendingParentVersionId: "old", presetVersions: [{ jobId: "old", status: "done", resultImageUrl: "old-result" }] }
  original.presetVersions.push({ jobId: "new", status: "processing", selectedSurfaceIds: ["wall-1"], scope: "selected" })
  const patch = recordStudioPresetResult(original, job)
  const updated = { ...original, ...patch }
  assert.equal(updated.presetVersions.length, 2)
  assert.equal(updated.selectedPresetVersionId, "new")
  assert.equal(updated.presetVersions[1].parentVersionId, "old")
  assert.deepEqual(updated.presetVersions[1].selectedSurfaceIds, ["wall-1"])
  assert.equal(updated.presetVersions[1].scope, "selected")
  assert.equal(recordStudioPresetResult(updated, job), null)
  assert.equal(recordStudioPresetResult(original, { ...job, id: "another-room" }), null)
  const reviewed = { ...updated, selectedPresetVersionId: "old" }
  assert.equal(recordStudioPresetResult(reviewed, job), null)
  assert.equal(getStudioWorkingBase(reviewed).mediaUrl, "old-result")
  assert.equal(getStudioWorkingBase({ ...reviewed, selectedPresetVersionId: undefined }).mediaUrl, base.mediaUrl)
  const failed = recordStudioPresetResult(original, { ...job, status: "failed", resultImageUrl: undefined })
  assert.equal(failed.selectedPresetVersionId, undefined)
  assert.equal(failed.presetVersions[0].resultImageUrl, "old-result")
})

test("preset jobs remain queueable but are omitted from Compositions; anonymous preset cannot enqueue", async () => {
  const { runInNewContext } = await import("node:vm")
  const storeSource = await readFile(new URL("../lib/server/composition-jobs-store.ts", import.meta.url), "utf8")
  let state = { jobs: [] }
  const storeModule = { exports: {} }
  const storeCode = ts.transpileModule(storeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(storeCode, { exports: storeModule.exports, crypto: globalThis.crypto, require: name => name.includes("postgres-json-store") ? { withJsonStoreLock: async (_, __, fn) => fn(), readJsonStore: async () => state, writeJsonStore: async ({}, value) => { state = value } } : name.includes("tenant-settings-store") ? { getTenantSettings: async () => ({ team: { members: [] } }) } : { getRuntimeDataFile: () => "mock-only" } })
  const store = storeModule.exports
  const input = buildStudioPresetInput("test", base, "renovate", { strength: 72 })
  const created = await store.createCompositionJob("test", { ...input, sourceMessageId: "idempotent" })
  const retry = await store.createCompositionJob("test", { ...input, sourceMessageId: "idempotent" })
  assert.equal(retry.created, false)
  assert.equal(retry.job.id, created.job.id)
  assert.equal((await store.getNextQueuedCompositionJob("test")).purpose, "studio-preset")
  const usage = { requestId: "provider-response", model: "synthetic", costUsd: .1, createdAt: "today" }
  await store.recordCompositionGenerationUsage("test", created.job.id, usage)
  await store.recordCompositionGenerationUsage("test", created.job.id, usage)
  assert.equal((await store.findCompositionJob("test", created.job.id)).generationUsage.length, 1, "provider IDs prevent duplicate costs")
  await assert.rejects(store.recordCompositionGenerationUsage("other", created.job.id, usage), /Job não encontrado/)

  await store.createCompositionJob("test", { ...input, purpose: "composition", sourceMessageId: "general" })
  const routeSource = await readFile(new URL("../app/api/tenant/[slug]/compositions/jobs/route.ts", import.meta.url), "utf8")
  const routeCode = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const routeModule = { exports: {} }
  let enqueueCalls = 0
  runInNewContext(routeCode, { exports: routeModule.exports, process: { env: {} }, require: name => {
    if (name === "next/server") return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } }
    if (name === "zod") return require("zod")
    if (name.endsWith("current-tenant-token")) return { getCurrentTenantToken: async () => null }
    if (name.includes("studio-surface-access")) return { checkStudioSurfaceAccess: token => token ? null : 401 }
    if (name.includes("composition-jobs-store")) return store
    if (name.includes("app-job-queue")) return { enqueueProcessCompositionQueue: async () => { enqueueCalls++ } }
    return {}
  } })
  const context = { params: Promise.resolve({ slug: "test" }) }
  const listed = await routeModule.exports.GET({}, context)
  assert.equal(listed.body.jobs.length, 1)
  assert.equal(listed.body.jobs[0].purpose, "composition")
  assert.equal(listed.body.stats.queued, 1)
  const rejected = await routeModule.exports.POST({ headers: new Headers(), nextUrl: new URL("http://127.0.0.1:3000"), json: async () => input }, context)
  assert.equal(rejected.status, 401)
  assert.equal(state.jobs.length, 2)
  assert.equal(enqueueCalls, 0)
})


test('manual location reaches the preset job while old surface metadata is ignored and preserved', async () => {
  const room = { ...base, selectedSurfaceIds: ['wall-1'], selectedSurfaceSourceKey: 'old-source', surfaceAnalysis: { sourceKey: 'old-analysis' } }
  const snapshot = structuredClone(room)
  const input = buildStudioPresetInput('test',room,'fresh-paint',{item:paint,placement:'somente a parede esquerda',strength:72})
  assert.match(input.prompt,/Manually specified target: somente a parede esquerda/)
  assert.match(input.prompt,/Preserve doors, windows, lights, furniture/)
  assert.match(input.prompt,/preserve the ceiling; do not paint it/)
  assert.doesNotMatch(input.prompt,/PLANOS_ALVO_ESTUDIO|Paint all already painted walls/)
  assert.equal(input.baseImageUrl,base.mediaUrl)
  assert.deepEqual(room,snapshot)
  await submitStudioPaintJob('test',input,async(url,request)=>{
    assert.match(JSON.parse(request.body).prompt,/parede esquerda/)
    return new Response(JSON.stringify({job:{id:'manual-job',tenantSlug:'test',status:'queued'}}))
  })
  assert.throws(()=>buildStudioPresetInput('test',room,'fresh-paint',{item:paint,scope:'selected',strength:72}),/foi desativada/)
  assert.throws(()=>buildStudioPresetInput('test',room,'fresh-paint',{item:paint,placement:'a'.repeat(501),strength:72}),/500 caracteres/)
  const whole = buildStudioPresetInput('test',room,'fresh-paint',{item:paint,strength:72})
  assert.match(whole.prompt,/Paint all already painted walls/)
})

test('manual Apply submits the chosen version without recognition or surface selectors', async () => {
  const {runInNewContext} = await import('node:vm')
  const source=await readFile(new URL('../components/studio-paint-flow.tsx',import.meta.url),'utf8')
  assert.doesNotMatch(source,/StudioSurfaces|Selecionar superfícies|beginSurfaceSelection|studio\/surfaces/)
  assert.match(source,/Descrição do cenário \(opcional\)/)
  const ast=ts.createSourceFile('flow.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let apply
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='apply')apply=node.getText(ast);ts.forEachChild(node,visit)}
  visit(ast)
  let submitted=0,error=null,savedPatch
  const room={...base,selectedSurfaceIds:['old-wall'],presetVersions:[{jobId:'chosen',status:'done',resultImageUrl:'chosen-result'}],selectedPresetVersionId:'chosen'}
  const state={disabled:false,uploadingReference:false,catalogActive:true,catalogSelections:{},isStudioMaterialPreset,STUDIO_PRESET_ORDER,selection:{base:room,item:paint,key:'synthetic-room',preset:'fresh-paint',strength:72},operationLock:{current:false},submittingLock:{current:false},pending:false,room:'living-room',luxury:false,includeCeiling:false,removeFixedFurniture:false,aggregate:true,placement:'parede ao fundo',slug:'test',buildStudioPresetsInput,buildStudioPresetInput,STUDIO_PRESETS:[{id:'fresh-paint',label:'Pintura nova'}],requestIds:{current:new Map()},crypto:globalThis.crypto,setSubmitting:()=>{},setApplyError:value=>{error=value},submitStudioPaintJob:async(slug,body)=>{submitted++;assert.equal(body.baseImageUrl,'chosen-result');assert.match(body.prompt,/parede ao fundo/);return {id:'mock-manual',status:'queued',createdAt:'now'}},setJobs:()=>{},onUpdate:(_key,patch)=>{savedPatch=patch},setSelection:()=>{},onClose:()=>{}}
  runInNewContext(ts.transpileModule(apply,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,state)
  await state.apply(state.selection)
  assert.equal(submitted,1)
  assert.equal(error,null)
  assert.equal(savedPatch.presetVersions.at(-1).manualTarget,'parede ao fundo')
  assert.equal(savedPatch.presetVersions.at(-1).parentVersionId,'chosen')
  assert.equal(room.selectedSurfaceIds[0],'old-wall')
})


test("deleting a completed preset persists a safe draft patch without resurrecting it or changing other images", () => {
  const room = { ...base, paintJobId: "one", selectedPresetVersionId: "one", pendingPresetId: "renovate", presetVersions: [{ jobId: "one", status: "done", resultImageUrl: "one-result" }, { jobId: "two", status: "done", resultImageUrl: "two-result", parentVersionId: "one" }, { jobId: "waiting", status: "processing" }] }
  const patch = removeStudioPresetVersion(room, "one")
  const restored = JSON.parse(JSON.stringify({ ...room, ...patch }))
  assert.deepEqual(restored.presetVersions.map(version => version.jobId), ["two", "waiting"])
  assert.equal(restored.selectedPresetVersionId, undefined)
  assert.equal(restored.paintJobId, undefined)
  assert.equal(getStudioWorkingBase(restored).mediaUrl, base.mediaUrl)
  assert.equal(recordStudioPresetResult(restored, { id: "one", status: "done", resultImageUrl: "one-result" }), null)
  assert.equal(room.presetVersions.length, 3)
  assert.equal(removeStudioPresetVersion(room, "waiting"), null)
  assert.equal(removeStudioPresetVersion(room, "absent"), null)
  const another = { ...room, selectedPresetVersionId: "two", paintJobId: "two" }
  const kept = { ...another, ...removeStudioPresetVersion(another, "one") }
  assert.equal(getStudioWorkingBase(kept).mediaUrl, "two-result")
  assert.equal(kept.paintJobId, "two")
})

test("fixed fixtures are removed only by explicit checkbox and the actual Apply caller forwards it", async () => {
  const untouched = { ...base, removeFixedFurniture: true }
  const ordinary = buildStudioPresetInput("test", untouched, "remove-furniture", { strength: 72 })
  assert.match(ordinary.prompt, /Remove loose furniture and movable furnishings only/)
  assert.match(ordinary.prompt, /Preserve attached or built-in furniture/)
  const expanded = buildStudioPresetInput("test", base, "remove-furniture", { strength: 72, removeFixedFurniture: true })
  assert.match(expanded.prompt, /Remove sinks, toilets or barbecue units only when they are detachable fittings/)
  assert.match(expanded.prompt, /Keep walls, structural columns, beams, ceiling height, doors, windows/)
  assert.doesNotMatch(expanded.prompt, /Remove loose furniture and movable furnishings only|Preserve attached or built-in furniture|ceiling and fixed elements/)
  assert.match(buildStudioPresetInput("test", base, "renovate", { strength: 72, removeFixedFurniture: true }).prompt, /Preserve existing furniture/)
  const source = await readFile(new URL("../components/studio-paint-flow.tsx", import.meta.url), "utf8")
  assert.match(source, /checked=\{removeFixedFurniture\}/)
  assert.match(source, /includeCeiling, removeFixedFurniture, aggregate/)
})


test("automatic furnishing selects at most five unique active room-compatible references and keeps aggregate", async () => {
  const furniture = Array.from({ length: 15 }, (_, i) => ({ ...paint, id: `room-item-${i}`, name: `Item ${i}`, imageUrl: "data:image/png;base64,aGVsbG8=", tags: { product_type: i % 2 ? "movel" : "decoracao", usage_mode: "catalogo", room_type: "kitchen" } }))
  const invalid = [{ ...furniture[0], id: "inactive", status: "inactive" }, { ...furniture[0], id: "foreign", tenantSlug: "other" }, { ...furniture[0], id: "bed", tags: { ...furniture[0].tags, room_type: "bedroom" } }, { ...furniture[0], id: "reference", tags: { ...furniture[0].tags, usage_mode: "referencia" } }, { ...furniture[0], id: "no-image", imageUrl: "" }]
  const chosen = chooseStudioFurniture([...furniture, furniture[0], ...invalid], "test", "kitchen", () => .5)
  assert.equal(chosen.length, 5)
  assert.equal(new Set(chosen.map(item => item.id)).size, 5)
  assert.ok(chosen.every(item => furniture.some(value => value.id === item.id)))
  assert.equal(chooseStudioFurniture(furniture.slice(0, 2), "test", "kitchen").length, 2)
  assert.equal(chooseStudioFurniture(furniture, "test", "bathroom").length, 0)
  const room = { ...base, selectedPresetVersionId: "edited", presetVersions: [{ jobId: "edited", status: "done", resultImageUrl: "edited-room" }] }
  const input = buildStudioPresetInput("test", room, "furnish", { furniture: chosen, aggregate: true, strength: 72 })
  assert.equal(input.baseImageUrl, "edited-room")
  assert.equal(input.references.length, 5)
  assert.match(input.prompt, /Preserve all existing furnishings and earlier edits/)
  const reversed = chooseStudioFurniture(furniture, "test", "kitchen", (() => { let n=1; return () => n-=.05 })())
  assert.notDeepEqual(reversed.map(item => item.id), chosen.map(item => item.id))
})

test("AI presets combine empty-room, renovation and furnishing in one ordered request without catalogue or manual prompt", () => {
  const scene = { ...base, combinePresets: true, roomType: "Varanda", propertyContexts: ["Casa", "Alto padrão"], sceneDescription: "Varanda pequena com iluminação natural", instruction: "This general prompt must not enter presets", materialReferences: { flooring: { catalogTenantSlug: "other", catalogItemId: "stale" } } }
  const selected = ["furnish", "renovate", "remove-furniture", "flooring"]
  const input = buildStudioPresetsInput("test", scene, selected, { strength: 72 })
  assert.deepEqual(input.presetIds, ["remove-furniture", "renovate", "flooring", "furnish"])
  assert.equal(input.purpose, "studio-preset")
  assert.equal(input.references.length, 0)
  assert.match(input.prompt, /^PRESETS_ESTUDIO: remove-furniture,renovate,flooring,furnish/)
  assert.ok(input.prompt.indexOf("1. Remove") < input.prompt.indexOf("2. Restore"))
  assert.ok(input.prompt.indexOf("2. Restore") < input.prompt.indexOf("4. Add furniture"))
  assert.match(input.prompt, /balcony|house|high-end|iluminação natural/)
  assert.doesNotMatch(input.prompt, /This general prompt|stale|Preserve existing furniture/)
  assert.equal(selected[0], "furnish", "caller selections are not mutated")
  const toggle = toggleStudioPreset(toggleStudioPreset({ ...base, combinePresets: true }, "remove-furniture"), "furnish")
  assert.ok(toggle.presetIds.includes("remove-furniture") && toggle.presetIds.includes("furnish"))
  for (const id of STUDIO_PRESET_ORDER) assert.equal(buildStudioPresetsInput("test", base, [id], { strength: 72 }).references.length, 0)
  assert.throws(() => buildStudioPresetsInput("test", base, [], { strength: 72 }), /válidos/)
  assert.throws(() => buildStudioPresetsInput("test", base, ["unknown"], { strength: 72 }), /válidos/)
  assert.throws(() => buildStudioPresetsInput("test", base, ["furnish", "furnish"], { strength: 72 }), /repetições/)
  assert.throws(() => buildStudioPresetsInput("test", { ...base, sceneDescription: "a".repeat(1001) }, ["furnish"], { strength: 72 }), /Contexto/)
})

test("optional catalogue validates tenant and compatible materials in the combined AI request", () => {
  const input = buildStudioPresetsInput("test", base, ["flooring", "furnish"], { strength: 72, materials: { flooring: floorMaterial }, furniture: [{ ...paint, id: "sofa", imageUrl: "data:image/png;base64,aGVsbG8=", tags: { product_type: "movel" } }] })
  assert.equal(input.references.length, 2)
  assert.match(input.prompt, /Piso de demonstração|apenas os móveis do catálogo/)
  assert.throws(() => buildStudioPresetsInput("other", base, ["flooring"], { strength: 72, materials: { flooring: floorMaterial } }), /compatível/)
})

test("generation costs retain failed attempts, real zero, missing values and combined presets", async () => {
  const { readGenerationUsage, summarizeGenerationCosts } = await load("../lib/generation-costs.ts")
  assert.equal(readGenerationUsage({ usage: { cost: 0 } }, "test").costUsd, 0)
  for (const cost of [null, "0.1", -1, Infinity, NaN]) assert.equal(readGenerationUsage({ usage: { cost } }, "test").costUsd, undefined)
  const jobs = [{ prompt: "", presetIds: ["remove-furniture", "furnish"], status: "done", processingAttempts: 1, generationUsage: [{costUsd:.1},{costUsd:.2},{costUsd:0},{model:"unknown"}] }, { prompt: "", presetIds: ["remove-furniture", "furnish"], status: "failed", processingAttempts: 1, generationUsage: [{costUsd:.3}] }, { prompt: "", status:"done",processingAttempts:1 }]
  const groups = summarizeGenerationCosts(jobs)
  assert.equal(groups[0].type, "combination:remove-furniture,furnish")
  assert.equal(groups[0].jobs, 2); assert.equal(groups[0].completed, 1)
  assert.equal(groups[0].attempts, 5); assert.equal(groups[0].knownCostAttempts, 4)
  assert.ok(Math.abs(groups[0].knownCostUsd - .6) < 1e-10)
  assert.equal(groups[0].unknownCosts, 1); assert.equal(groups[1].unknownCosts, 1)
})


test("one scenario may use the second environment; independent slots survive quantity, base changes and serialization", () => {
  const rooms=[{ ...base, mediaUrl:"first-room",instruction:"legacy first" }, { ...base,mediaUrl:"second-room",instruction:"legacy second",selectedPresetVersionId:"principal",presetVersions:[{jobId:"principal",status:"done",resultImageUrl:"edited-second"}]}]
  const refs=[{...base,mediaUrl:"ref-a"},{...base,mediaUrl:"ref-b"}]
  let slots=ensureStudioScenarios([],rooms)
  assert.equal(slots[1].instruction,"legacy second")
  slots=slots.map((slot,i)=>i===0?{...slot,baseKey:getStudioArtifactKey(rooms[1]),selectedReferenceUrls:["ref-a"],instruction:"Direção A"}:{...slot,selectedReferenceUrls:["ref-b"],instruction:"Direção B"})
  const snapshot=JSON.stringify(slots)
  const one=planStudioScenarios(slots,rooms,refs).slice(0,1)
  const request=buildStudioCompositionInput("test",one[0].base,one[0].references,"general")
  assert.equal(one[0].baseIndex,1)
  assert.equal(request.baseImageUrl,"edited-second")
  assert.deepEqual(request.references.map(ref=>ref.imageUrl),["ref-a"])
  assert.match(request.prompt,/Direção A/)
  const both=planStudioScenarios(slots,rooms,refs).slice(0,2)
  assert.deepEqual(both.map(row=>row.references.map(ref=>ref.mediaUrl)),[["ref-a"],["ref-b"]])
  assert.deepEqual(both.map(row=>row.base.instruction),["Direção A","Direção B"])
  assert.equal(JSON.stringify(slots),snapshot)
  slots=JSON.parse(snapshot)
  const otherBefore=JSON.stringify(slots[1])
  slots=slots.map((slot,i)=>i===0?{...slot,baseKey:getStudioArtifactKey(rooms[0])}:slot)
  assert.equal(JSON.stringify(slots[1]),otherBefore)
  assert.equal(slots[0].instruction,"Direção A")
  assert.deepEqual(slots[0].selectedReferenceUrls,["ref-a"])
  assert.equal(ensureStudioScenarios(slots,rooms),slots)
  assert.equal(planStudioScenarios(slots,rooms.slice(1),refs)[0].base,null)
})

test("real batch caller sends scenario-specific base, references and instructions; active slot clamps without erasing choices", async () => {
  const {runInNewContext}=await import("node:vm")
  const source=await readFile(new URL("../components/studio-batch.tsx",import.meta.url),"utf8")
  const ast=ts.createSourceFile("batch.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  let batch,clamp
  function visit(node){
    if(ts.isFunctionDeclaration(node)&&node.name?.text==="createBatchCompositions")batch=node.getText(ast)
    if(ts.isCallExpression(node)&&node.expression.getText(ast)==="useEffect"&&node.arguments[0]?.getText(ast).includes("activeScenarioIndex === currentScenarioIndex"))clamp=node.arguments[0].getText(ast)
    ts.forEachChild(node,visit)
  }
  visit(ast);assert.ok(batch);assert.ok(clamp)
  const rooms=[{...base,mediaUrl:"room-1"},{...base,mediaUrl:"room-2",selectedPresetVersionId:"principal",presetVersions:[{jobId:"principal",status:"done",resultImageUrl:"principal-image"}]}]
  const refs=[{...base,mediaUrl:"ref-1"},{...base,mediaUrl:"ref-2"}]
  const slots=[{baseKey:getStudioArtifactKey(rooms[1]),selectedReferenceUrls:["ref-1"],instruction:"Primeira direção"},{baseKey:getStudioArtifactKey(rooms[0]),selectedReferenceUrls:["ref-2"],instruction:"Segunda direção"}]
  const plans=planStudioScenarios(slots,rooms,refs)
  let bodies=[],error=null,active=1,preview=0
  plans[1].variationCount=0
  const state={plannedCombinations:plans,expandStudioScenarioVariations,canGenerate:true,isGenerating:false,operationLock:{current:false},setIsGenerating:()=>{},setError:e=>{error=e},setStatusMessage:()=>{},setCreatedJobs:()=>{},setIsBatchProgress:()=>{},setShowResults:()=>{},buildStudioCompositionInput,slug:"test",prompt:"General",strength:72,crypto:globalThis.crypto,batchRequests:{current:new Map()},Blob,MAX_REQUEST_BYTES,fetch:async(_url,request)=>{bodies.push(JSON.parse(request.body));return new Response(JSON.stringify({job:{id:`mock-${bodies.length}`,status:"queued"}}))},activeScenarioIndex:1,currentScenarioIndex:0,currentPlan:plans[0],setActiveScenarioIndex:v=>{active=v},setActiveBaseIndex:v=>{preview=v}}
  runInNewContext(ts.transpileModule(batch,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,state)
  await state.createBatchCompositions()
  assert.equal(error,null);assert.equal(bodies.length,1);assert.equal(bodies[0].baseImageUrl,"principal-image");assert.match(bodies[0].prompt,/Primeira direção/)
  plans[1].variationCount=1;bodies=[];await state.createBatchCompositions()
  assert.equal(bodies.length,2);assert.deepEqual(bodies.map(body=>body.references[0].imageUrl),["ref-1","ref-2"])
  assert.match(bodies[1].prompt,/Segunda direção/);assert.doesNotMatch(bodies[1].prompt,/Primeira direção/)
  plans[0].variationCount=2;bodies=[];await state.createBatchCompositions()
  assert.equal(bodies.length,3)
  assert.equal(new Set(bodies.map(body=>body.sourceMessageId)).size,3)
  assert.deepEqual(bodies.map(body=>body.references[0].imageUrl),["ref-1","ref-1","ref-2"])
  assert.deepEqual(bodies.map(body=>body.baseImageUrl),["principal-image","principal-image","room-1"])
  const snapshot=JSON.stringify(slots)
  runInNewContext(ts.transpileModule(`(${clamp})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,state)
  assert.equal(active,0);assert.equal(preview,1);assert.equal(JSON.stringify(slots),snapshot)
})


test("thumbnail loader follows only the current image job and stops on completion or failure", async () => {
  const { runInNewContext } = await import("node:vm")
  const source = await readFile(new URL("../components/studio-paint-flow.tsx", import.meta.url), "utf8")
  const ast = ts.createSourceFile("batch.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let expression
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "pendingVersion") expression = node.initializer.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(expression)
  const code = ts.transpileModule(`result = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  function visiblePreset(base) {
    const state = { base, result: null }
    runInNewContext(code, state)
    return state.result?.preset
  }
  const room = { ...base, paintJobId: "running", presetVersions: [{ jobId: "old", preset: "renovate", status: "processing" }, { jobId: "running", preset: "fresh-paint", status: "queued" }] }
  assert.equal(visiblePreset(room), "fresh-paint")
  const processing = { ...room, ...recordStudioPresetResult(room, { id: "running", status: "processing", createdAt: "now" }) }
  assert.equal(visiblePreset(processing), "fresh-paint")
  const done = { ...processing, ...recordStudioPresetResult(processing, { id: "running", status: "done", resultImageUrl: "result", createdAt: "now" }) }
  const failed = { ...processing, ...recordStudioPresetResult(processing, { id: "running", status: "failed", createdAt: "now" }) }
  assert.equal(visiblePreset(done), undefined)
  assert.equal(visiblePreset(failed), undefined)
  assert.equal(visiblePreset({ ...room, paintJobId: undefined }), undefined)
  assert.equal(visiblePreset({ ...base, paintJobId: "other", presetVersions: room.presetVersions }), undefined)
  assert.match(source, /pendingVersion && <div/)
  assert.match(source, /role="img" aria-label=\{`\$\{pendingVersion.label\} — imagem em geração`\} aria-busy="true"/)
  assert.match(source, /styles.presetThumbnailSpinner/)
  const batch = await readFile(new URL("../components/studio-batch.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(batch, /activePresetJob|gerando imagem/)
  const css = await readFile(new URL("../components/studio-batch.module.css", import.meta.url), "utf8")
  assert.match(css, /animation:studioThumbnailSpin \.8s linear infinite/)
  assert.match(css, /prefers-reduced-motion:reduce.*presetThumbnailSpinner.*animation:none/)
})


test("scenario variations persist independently, preserve legacy disabled slots and produce separate jobs", async () => {
  const rooms=[{...base,mediaUrl:"room-a"},{...base,mediaUrl:"room-b"}]
  const refs=[{...base,mediaUrl:"ref-a"},{...base,mediaUrl:"ref-b"}]
  const legacy=ensureStudioScenarios([],rooms,1)
  assert.deepEqual(legacy.map(slot=>slot.variationCount),[1,0])
  const slots=legacy.map((slot,index)=>({...slot,variationCount:index?3:2,selectedReferenceUrls:[refs[index].mediaUrl],instruction:`Direction ${index}`}))
  const restored=JSON.parse(JSON.stringify(slots))
  const plan=planStudioScenarios(restored,rooms,refs)
  const jobs=expandStudioScenarioVariations(plan)
  assert.equal(jobs.length,5)
  assert.equal(new Set(jobs.map(job=>job.id)).size,5)
  assert.deepEqual(jobs.map(job=>job.references[0].mediaUrl),["ref-a","ref-a","ref-b","ref-b","ref-b"])
  assert.deepEqual(jobs.map(job=>job.base.instruction),["Direction 0","Direction 0","Direction 1","Direction 1","Direction 1"])
  const reduced=restored.map((slot,index)=>index?slot:{...slot,variationCount:0})
  assert.equal(expandStudioScenarioVariations(planStudioScenarios(reduced,rooms,refs)).length,3)
  assert.deepEqual(reduced[1],restored[1])
  const previous=ensureStudioScenarios(slots,rooms,1)
  assert.deepEqual(previous.map(slot=>slot.variationCount),[2,3])
  const source=await readFile(new URL("../components/studio-batch.tsx",import.meta.url),"utf8")
  assert.doesNotMatch(source,/Configuração do lote|setTargetOutputCount/)
  assert.match(source,/role="group" aria-label="Cenários"/)
  assert.doesNotMatch(source,/<NativeSelect aria-label="Cenário para configurar"/)
  assert.match(source,/Variações no cenário \{currentScenarioIndex \+ 1\}/)
  assert.match(source,/aria-label="Quantidade de variações deste cenário"/)
  assert.match(source,/R\{index \+ 1\}/)
})


test("real worker caller records paid no-image failures and unknown network attempts; storage failure stops further paid requests", async () => {
  const { runInNewContext } = await import("node:vm")
  const { readGenerationUsage } = await load("../lib/generation-costs.ts")
  const source = await readFile(new URL("../lib/server/openrouter-image-worker.ts", import.meta.url), "utf8")
  const ast = ts.createSourceFile("worker.ts", source, ts.ScriptTarget.Latest, true)
  const functions = []
  function visit(node) { if (ts.isFunctionDeclaration(node) && ["requestOpenRouterImage", "generateImageWithOpenRouter"].includes(node.name?.text)) functions.push(node.getText(ast)); ts.forEachChild(node, visit) }
  visit(ast)
  const recorded = []
  let calls = 0
  const state = { Error, AbortSignal, readGenerationUsage, listOpenRouterModels: async () => [{id:"test",inputModalities:["image"],outputModalities:["image"]},{id:"test-model",inputModalities:["image"],outputModalities:["image"]}], isModelCompatible: () => true, appendPath: (url, path) => url + path, getOpenRouterHeaders: () => ({}), getOpenRouterImageConfig: () => ({}), recordCompositionGenerationUsage: async (_tenant, _job, usage) => recorded.push(usage), getImageUrlFromPayload: () => null, getPayloadTextPreview: () => "", getPayloadNoImageDiagnostic: () => "no image", getOpenRouterError: () => "HTTP error", fetch: async () => { calls++; return { ok:true, json: async () => ({ id:"paid-response", usage:{cost:.1} }) } }, readAiModelProfiles: async () => [{modelId:"test-model", purpose:"image_generation", enabled:true}], getCatalogMaterialImages: async () => [], buildOpenRouterImageContent: () => [] }
  runInNewContext(ts.transpileModule(functions.join("\n"), {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText, state)
  const job = { tenantSlug:"test",id:"synthetic-job" }
  await assert.rejects(state.requestOpenRouterImage({baseUrl:"https://synthetic.invalid"},"test",job,{},[],{}), /nao retornou imagem/)
  assert.equal(recorded[0].costUsd,.1)
  state.fetch = async () => { throw new Error("network timeout") }
  await assert.rejects(state.requestOpenRouterImage({baseUrl:"https://synthetic.invalid"},"test",job,{},[],{}), /network timeout/)
  assert.equal(recorded.at(-1).costUsd,undefined)
  state.fetch = async () => { calls++; return {ok:true,json:async()=>({usage:{cost:.2}})} }
  state.recordCompositionGenerationUsage = async () => { throw new Error("storage unavailable") }
  const previousCalls = calls
  await assert.rejects(state.generateImageWithOpenRouter({baseUrl:"https://synthetic.invalid"},job,{},""), error => error.name === "GenerationUsageStorageError")
  assert.equal(calls - previousCalls,1,"a persistence error cannot trigger more paid model attempts")
})


test("preset refinements are scoped, painting has color texture and shared finishes accept wall targets", () => {
  const options = { strength: 72 }
  const configured = { ...base, roomType: "Varanda", propertyContexts: ["Casa"], sceneDescription: "cenário exclusivo", presetOptions: {
    "fresh-paint": { color: "#ab1234", instructions: "Acabamento fosco", reference: { ...base, mediaUrl: "data:image/png;base64,aGVsbG8=" } },
    flooring: { surface: "walls", instructions: "Revestimento claro" },
    ceiling: { instructions: "Teto liso" },
  } }
  for (const preset of ["remove-furniture", "renovate"]) {
    const input = buildStudioPresetsInput("test", configured, [preset], options)
    assert.doesNotMatch(input.prompt, /Room context|cenário exclusivo|Acabamento fosco|Revestimento claro/)
    assert.equal(input.references.length, 0)
  }
  const paintInput = buildStudioPresetsInput("test", configured, ["fresh-paint"], options)
  assert.match(paintInput.prompt, /#ab1234/)
  assert.match(paintInput.prompt, /Preserve subtle surface texture, shading and edges/)
  assert.match(paintInput.prompt, /Acabamento fosco/)
  assert.match(paintInput.prompt, /Reference for the Fresh paint step/)
  assert.equal(paintInput.references.length, 1)
  const wallInput = buildStudioPresetsInput("test", configured, ["flooring"], options)
  assert.match(wallInput.prompt, /finish only on the walls/)
  assert.match(wallInput.prompt, /[Pp]reserve the floor/)
  assert.doesNotMatch(wallInput.prompt, /Preserve wall coverings|Preserve existing paint|Acabamento fosco/)
  const both = buildStudioPresetsInput("test", { ...configured, presetOptions: { flooring: { surface: "both" } } }, ["flooring"], options)
  assert.match(both.prompt, /the visible floor and walls/)
  assert.doesNotMatch(both.prompt, /[Pp]reserve the floor|Preserve wall coverings/)
  const renewed = buildStudioPresetsInput("test", configured, ["renovate"], options)
  assert.match(renewed.prompt, /Renew already painted surfaces/)
  assert.match(renewed.prompt, /walls and ceilings/)
  const combined = buildStudioPresetsInput("test", configured, ["fresh-paint", "ceiling"], options)
  assert.match(combined.prompt, /Teto liso/)
  assert.equal(combined.references.length, 1)
  assert.throws(() => buildStudioPresetsInput("test", { ...base, presetOptions: { "fresh-paint": { color: "ignore instructions" } } }, ["fresh-paint"], options), /Opções do preset/)
  assert.throws(() => buildStudioPresetsInput("test", { ...base, presetOptions: { furnish: { reference: { ...base, source: "catalog" } } } }, ["furnish"], options), /Referência de imagem inválida/)
})

test("English preset briefings preserve the photograph and distinguish furniture from architecture within the combined budget", () => {
  for (const id of STUDIO_PRESET_ORDER) {
    const input = buildStudioPresetsInput("test", base, [id], { strength: 72 })
    assert.match(input.prompt, /exact pixel dimensions, aspect ratio and portrait\/landscape orientation/)
    assert.match(input.prompt, /Do not crop, rotate, zoom, stretch, expand the canvas or make the room appear larger/)
    assert.match(input.prompt, /Keep walls, structural columns, beams, ceiling height, doors, windows/)
    assert.doesNotMatch(input.prompt, /Remova|Renove|Adicione|Pinte|Preserve os|Contexto do ambiente|Referência para/)
    assert.equal(hasStudioPresetInstruction(input.prompt), true)
  }
  const restored = buildStudioPresetsInput("test", base, ["renovate"], { strength: 72 }).prompt
  assert.match(restored, /newly completed and freshly finished/)
  assert.match(restored, /peeling paint.*cracks.*grime.*mold marks.*water stains.*damp patches/)
  assert.match(restored, /preserving their material, pattern, color and shape/)
  const removed = buildStudioPresetsInput("test", base, ["remove-furniture"], { strength: 72, removeFixedFurniture: true }).prompt
  assert.match(removed, /masonry counters, structural or masonry-integrated countertops, half-walls, pillars, stairs/)
  assert.match(removed, /when uncertain, preserve the element/)
  assert.match(removed, /Reconstruct only the newly exposed wall\/floor surfaces/)
  const combined = buildStudioPresetsInput("test", base, STUDIO_PRESET_ORDER, { strength: 72, removeFixedFurniture: true, includeCeiling: true })
  assert.ok(combined.prompt.length <= 5000)
  assert.equal(combined.presetIds.length, 7)
  assert.equal(combined.references.length, 0)
  assert.doesNotMatch(combined.prompt, /preserve the ceiling; do not paint it/)
  const raw = "Mantenha o quadro azul"
  assert.ok(getStudioInstruction({ ...base, instruction: raw, presetIds: ["renovate"] }, "").includes(raw), "user-entered descriptions are retained verbatim")
})
