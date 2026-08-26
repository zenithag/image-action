import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

test("Home 2 serves the isolated marketing experience", async () => {
  const response = await fetch("http://localhost:3000/home-2")
  const html = await response.text()

  assert.equal(response.status, 200)
  assert.match(html, /Mostre o que o cliente ainda não consegue ver/)
  assert.match(html, /Simulação visual ilustrativa/)
})

test("Home 2 has a dedicated compact-mobile layout", async () => {
  const css = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(css, /@media\(max-width:600px\)/)
  assert.match(css, /@media\(min-width:801px\)/)
})

test("Home 2 scopes desktop hero spacing to the hero container", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8"),
  ])

  assert.match(component, /data-home-two-hero/)
  assert.match(css, /\[data-home-two-hero\]/)
  assert.doesNotMatch(css, /:global\(\[class\*="home-two_hero"\]\)\{display:block/)
})

test("Home 2 gives the hero a lighter surface with subtle technical lines", async () => {
  const css = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(css, /--hero-surface/)
  assert.match(css, /data-home-two-hero\]::before/)
})

test("Home 2 uses the official logo in the primary navigation", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")

  assert.match(component, /logo-horizontal-azul\.svg/)
})

test("Home 2 places the animated WhatsApp flow in the statement section", async () => {
  const [component, phone] = await Promise.all([
    readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/home-two-flow-phone.tsx", import.meta.url), "utf8"),
  ])

  assert.match(component, /FlowPhone/)
  assert.match(component, /data-home-two-statement-phone/)
  assert.doesNotMatch(component, /data-home-two-flow-phone-slot/)
  assert.match(phone, /IntersectionObserver/)
  assert.match(phone, /Tintas Aurora/)
})

test("Home 2 presents applications as visual service cards", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")

  assert.match(component, /data-home-two-audience-image/)
  assert.match(component, /compare\/tinta\/depois\.png/)
})

test("Home 2 gives every application card an accessible before-and-after comparison", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")

  assert.match(component, /data-home-two-audience-compare/)
  assert.match(component, /aria-label={`Comparar imagem original e simulação para \$\{name\}`}/)
  assert.match(component, /compare\/planejados\/antes\.jpg/)
  assert.match(component, /compare\/tinta\/antes\.jpg/)
  assert.match(component, /compare\/porcelanato\/antes-hq\.png/)
})

test("Home 2 marks the applications for the asymmetric services grid", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(component, /data-home-two-audience-card/)
  assert.match(responsiveStyles, /data-home-two-audience-primary\] \[data-home-two-audience-card\]/)
})

test("Home 2 collapses the asymmetric applications grid before tablet widths become cramped", async () => {
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(responsiveStyles, /@media\(max-width:800px\)\{[^]*data-home-two-audience-card]:first-child\{grid-row:auto/)
})

test("Home 2 scopes application-card rules away from the section and list containers", async () => {
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.doesNotMatch(responsiveStyles, /:global\(\[class\*="home-two_audience"\]\)/)
})

test("Home 2 aligns the applications heading to the left", async () => {
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(responsiveStyles, /home-two_audienceHeading"\]\)\{display:block/)
})

test("Home 2 composes applications as a left feature column and a right stacked column", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(component, /data-home-two-audience-layout/)
  assert.match(component, /data-home-two-audience-primary/)
  assert.match(component, /data-home-two-audience-secondary/)
  assert.match(responsiveStyles, /data-home-two-audience-layout\]\{display:grid;grid-template-columns/)
})

test("Home 2 places the applications heading above the service imagery", async () => {
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(responsiveStyles, /home-two_audienceHeading"\]\)\{grid-column:1\/-1/)
  assert.match(responsiveStyles, /data-home-two-audience-primary\]\{display:contents/)
})

test("Home 2 places the complete primary application card alongside the section heading", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.doesNotMatch(component, /data-home-two-audience-primary-index/)
  assert.match(responsiveStyles, /data-home-two-audience-primary\] \[data-home-two-audience-card\]\{grid-column:2;grid-row:1/)
})

test("Home 2 presents the final CTA as a dedicated decision panel", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")
  const responsiveStyles = await readFile(new URL("../components/home-two-responsive.module.css", import.meta.url), "utf8")

  assert.match(component, /data-home-two-cta-copy/)
  assert.match(component, /data-home-two-cta-action/)
  assert.match(responsiveStyles, /data-home-two-cta-panel\]\{position:relative;display:grid/)
})

test("Home 2 gives the applications heading supporting context", async () => {
  const component = await readFile(new URL("../components/home-two.tsx", import.meta.url), "utf8")

  assert.match(component, /data-home-two-audience-intro/)
})
