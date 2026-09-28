import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
async function load(relative) {
  const source = await readFile(new URL(relative, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}
const { validateStudioFiles, buildStudioInput, MAX_UPLOAD_BYTES } = await load("../lib/studio-v1.ts")
const { getStudioArtifactKey } = await load("../lib/studio-draft.ts")
const file = { type: "image/png", size: 100 }
const base = { source: "upload", mediaUrl: "data:image/webp;base64,base", createdAt: "2026-09-28" }

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
  assert.match(input.prompt, /em conjunto/)
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
  assert.match(input.prompt, /Referência 2: Produto/)
  assert.ok(input.prompt.length <= 5000)
})
