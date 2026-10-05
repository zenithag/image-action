import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"

const require = createRequire(new URL("../package.json", import.meta.url))
const ts = require("typescript")
const source = await readFile(new URL("../lib/auth-routing.ts", import.meta.url), "utf8")
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { getLoginRedirectPath, getSafeCallbackUrl } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

test("login navigation retains the current origin for canonical auth URLs", () => {
  assert.equal(getLoginRedirectPath("http://localhost:3000/auth/post-login"), "/auth/post-login")
  assert.equal(getLoginRedirectPath("http://127.0.0.1:3000/tenant/teste?view=studio#images"), "/tenant/teste?view=studio#images")
  assert.equal(getLoginRedirectPath("/superadmin"), "/superadmin")
})

test("login callback cannot navigate to an external origin or unsafe scheme", () => {
  assert.equal(getLoginRedirectPath("https://example.invalid/tenant/teste"), "/tenant/teste")
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://example.invalid//other.invalid", "http://["]) {
    assert.equal(getLoginRedirectPath(url), "/auth/post-login")
  }
})

test("URL normalization is disabled only in development", async () => {
  const configSource = await readFile(new URL("../next.config.ts", import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(configSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  for (const environment of ["development", "production", "test"]) {
    const context = { exports: {}, process: { env: { NODE_ENV: environment } } }
    runInNewContext(outputText, context)
    assert.equal(context.exports.default.skipMiddlewareUrlNormalize, environment === "development")
  }
})

test("existing role and tenant callback restrictions remain intact", () => {
  const user = { roles: ["operator"], tenantSlug: "teste" }
  assert.equal(getSafeCallbackUrl("/superadmin", user), "/tenant/teste")
  assert.equal(getSafeCallbackUrl("/tenant/other", user), "/tenant/teste")
  assert.equal(getSafeCallbackUrl("/tenant/teste/editor", user), "/tenant/teste/editor")
  assert.equal(getSafeCallbackUrl("//other.invalid", user), "/tenant/teste")
})
