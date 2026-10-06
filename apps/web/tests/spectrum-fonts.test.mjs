import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import fs from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"

const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
const localLoader = require("next/dist/compiled/@next/font/dist/local/loader").default
const fontModule = require("next/dist/compiled/@next/font/dist/fontkit").default
const parseFont = fontModule.default || fontModule
const providerUrl = new URL("../components/spectrum/spectrum-provider.tsx", import.meta.url)

test("Spectrum bundles the original Source families with real Next local-font output", async () => {
  const source = await readFile(providerUrl, "utf8")
  assert.doesNotMatch(source, /next\/font\/google/)
  const ast = ts.createSourceFile("provider.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const calls = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === "localFont") {
      calls.push([node.name.getText(ast), runInNewContext(`(${node.initializer.arguments[0].getText(ast)})`)])
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.equal(calls.length, 2)
  for (const [name, options] of calls) {
    const family = name === "sourceSans" ? "SourceSans3VF" : "SourceCodeVF"
    const variable = name === "sourceSans" ? "--font-source-sans" : "--font-source-code"
    const file = fileURLToPath(new URL(options.src, providerUrl))
    const buffer = await readFile(file)
    const metadata = parseFont(buffer)
    assert.equal(metadata.familyName, family)
    assert.equal(metadata.variationAxes.wght.min, 200)
    assert.equal(metadata.variationAxes.wght.max, 900)
    const emitted = []
    const result = await localLoader({
      functionName: "", variableName: name, data: [options],
      resolve: async () => file, loaderContext: { fs },
      emitFontFile: (data, extension, preload) => {
        assert.ok(data.equals(buffer))
        emitted.push({ extension, preload })
        return `/_next/static/media/${name}.${extension}`
      },
    })
    assert.equal(result.variable, variable)
    assert.match(result.css, /font-weight: 200 900/)
    assert.match(result.css, /font-display: swap/)
    assert.match(result.css, /font-style: normal/)
    assert.match(result.css, /url\(\/_next\/static\/media\//)
    assert.doesNotMatch(result.css, /https?:\/\//)
    assert.deepEqual(emitted, [{ extension: "woff2", preload: true }])
  }
})
