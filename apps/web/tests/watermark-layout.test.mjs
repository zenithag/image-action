import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"

const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
const sharp = require("sharp")
function load(relativePath, aliases = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(source, { module, exports: module.exports, Buffer, require: (name) => aliases[name] || require(name) })
  return module.exports
}
const layout = load("../lib/watermark-layout.ts")
const { renderLogoWatermark } = load("../lib/server/watermark-render.ts", { "@/lib/watermark-layout": layout })

test("free placement, legacy positions and malformed percentages remain bounded", () => {
  for (const [width, height] of [[800, 520], [520, 800], [101, 99]]) {
    for (const x of [0, 33, 100]) for (const y of [0, 67, 100]) {
      const box = layout.getWatermarkBox(width, height, { watermarkPosition: "custom", watermarkX: x, watermarkY: y, watermarkSize: 200 })
      assert.ok(box.left >= 0 && box.top >= 0)
      assert.ok(box.left + box.width <= width && box.top + box.height <= height)
      assert.equal(box.left, Math.round((width - box.width) * x / 100))
    }
  }
  assert.equal(layout.getWatermarkPlacement({ watermarkPosition: "center" }).x, 50)
  assert.equal(layout.getWatermarkPlacement({ watermarkPosition: "bottom-right" }).x, 97)
  assert.equal(layout.normalizeWatermarkPercent(NaN, 50), 50)
  assert.equal(layout.normalizeWatermarkPercent(200, 50), 100)
})

test("actual logo raster uses preview placement and opacity, preserving source alpha", async () => {
  const logo = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 220, g: 30, b: 30, alpha: 0.5 } } }).png().toBuffer()
  for (const [x, y, opacity] of [[0, 0, 100], [100, 100, 50], [34, 76, 0]]) {
    const settings = { watermarkPosition: "custom", watermarkX: x, watermarkY: y, watermarkOpacity: opacity }
    const preview = layout.getWatermarkBox(800, 520, settings)
    const overlay = await renderLogoWatermark(logo, 800, 520, settings)
    assert.equal(overlay.left, preview.left)
    assert.equal(overlay.top, preview.top)
    const { data, info } = await sharp(overlay.input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(info.width, preview.width)
    assert.equal(info.height, preview.height)
    const centerAlpha = data[((Math.floor(info.height / 2) * info.width) + Math.floor(info.width / 2)) * 4 + 3]
    assert.ok(Math.abs(centerAlpha - 127.5 * opacity / 100) <= 2)
    // Simulate the real output composite, without generation or storage.
    const result = await sharp({ create: { width: 800, height: 520, channels: 4, background: "black" } }).composite([overlay]).png().toBuffer()
    assert.equal((await sharp(result).metadata()).width, 800)
  }
})

test("text preview/export use the same escaped SVG and can occupy any position", async () => {
  const settings = { watermarkPosition: "custom", watermarkX: 100, watermarkY: 0, watermarkOpacity: 75 }
  const svg = layout.createTextWatermarkSvg(800, 520, settings, 'Empresa <teste> & "nome"')
  assert.match(svg, /&lt;teste&gt; &amp; &quot;nome&quot;/)
  assert.match(svg, /opacity="0.75"/)
  const image = await sharp(Buffer.from(svg)).png().toBuffer()
  assert.equal((await sharp(image).metadata()).width, 800)
  const previewSource = readFileSync(new URL("../components/tenant-settings-panel.tsx", import.meta.url), "utf8")
  const workerSource = readFileSync(new URL("../lib/server/openrouter-image-worker.ts", import.meta.url), "utf8")
  assert.match(previewSource, /createTextWatermarkSvg\(800, 520, settings.branding/)
  assert.match(workerSource, /createTextWatermarkSvg\(width, height, branding, text\)/)
  assert.match(workerSource, /renderLogoWatermark\(logo.bytes, width, height, settings\)/)
})
