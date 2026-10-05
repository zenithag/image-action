/**
 * Como fica.ai brand palette ("ID VISUAL COMO FICA.AI", page 7): Dark Blue and Tifany.
 * The palette's white (#FFFFFF) is intentionally NOT used yet: surfaces keep the current neutral
 * greys, and light text is a Tifany tint rather than pure white.
 *
 * It is the default theme a tenant gets when it subscribes (primary colour = Tifany). Picking any
 * other colour in "Marca & dados" (the graphite, indigo... presets or a custom colour) switches the
 * console to that accent with the neutral text colours it had before.
 *
 * To roll the palette back:
 *   - quickest:  NEXT_PUBLIC_BRAND_PALETTE=off in apps/web/.env.local, then restart `pnpm dev:web`
 *   - or:        set BRAND_PALETTE_ENABLED to false below
 *   - everything: scripts/rollback-brand-palette.sh  (restores the checkpoint taken before the test)
 */
import { getTenantAccentVariables } from "@/lib/tenant-branding"

export const BRAND_PALETTE_ENABLED = process.env.NEXT_PUBLIC_BRAND_PALETTE !== "off"

/**
 * Experiment: the side menu and the page headers on the palette's white. Only the chrome (menu and
 * headers) changes; the page and the content keep their greys. Turn it off with
 * NEXT_PUBLIC_WHITE_CHROME=off (then restart pnpm dev:web) or by setting this to false.
 */
export const WHITE_CHROME_ENABLED = process.env.NEXT_PUBLIC_WHITE_CHROME !== "off"

export const BRAND = {
  darkBlue: "#00165A",
  tifany: "#01CFB0",
  white: "#FFFFFF",
} as const

function channel(hex: string, index: number) {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
}

function mix(from: string, to: string, ratio: number) {
  const out = [0, 1, 2].map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * ratio))
  return `#${out.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

/** CSS variables for the console, applied on the sp-theme element (so they win over .cf-panel). */
export function getBrandPaletteVariables(dark: boolean): Record<string, string> {
  const { darkBlue, tifany } = BRAND
  // Neutral references already used by the console surfaces; the tints are mixed towards them.
  const page = dark ? "#1D1D1D" : "#E9E9E9"
  const card = dark ? "#262626" : "#F8F8F8"

  const ink = dark ? mix(tifany, "#F3F3F3", 0.88) : darkBlue
  const inkMuted = mix(ink, page, dark ? 0.32 : 0.38)
  const inkSubtle = mix(ink, page, dark ? 0.46 : 0.52)
  const border = mix(ink, card, dark ? 0.78 : 0.86)
  const borderStrong = mix(ink, page, dark ? 0.5 : 0.55)

  const accent = tifany
  const hover = dark ? mix(tifany, "#F3F3F3", 0.18) : mix(tifany, darkBlue, 0.14)
  const down = dark ? mix(tifany, "#F3F3F3", 0.3) : mix(tifany, darkBlue, 0.28)
  const soft = dark ? mix(tifany, card, 0.78) : mix(tifany, card, 0.8)
  const softHover = dark ? mix(tifany, card, 0.68) : mix(tifany, card, 0.68)
  const onAccent = darkBlue

  return {
    // text and neutrals (shadcn bridge + design-system aliases)
    "--cf-ink": ink,
    "--cf-ink-muted": inkMuted,
    "--cf-ink-subtle": inkSubtle,
    "--cf-border": border,
    "--cf-border-strong": borderStrong,
    "--foreground": ink,
    "--card-foreground": ink,
    "--popover-foreground": ink,
    "--secondary-foreground": ink,
    "--accent-foreground": ink,
    "--muted-foreground": inkMuted,
    "--border": border,
    "--input": border,
    // accent
    "--cf-accent": accent,
    "--cf-accent-hover": hover,
    "--cf-accent-soft": soft,
    "--cf-accent-soft-hover": softHover,
    "--cf-accent-ink": dark ? tifany : darkBlue,
    "--cf-on-accent": onAccent,
    "--cf-brand": accent,
    "--cf-brand-hover": hover,
    "--cf-brand-soft": soft,
    "--cf-brand-ink": dark ? tifany : darkBlue,
    "--cf-on-brand": onAccent,
    "--cf-surface-selected": soft,
    "--cf-focus": dark ? tifany : darkBlue,
    "--primary": accent,
    "--primary-foreground": onAccent,
    "--ring": dark ? tifany : darkBlue,
    "--sidebar-primary": accent,
    "--sidebar-primary-foreground": onAccent,
    "--sidebar-accent": soft,
    "--sidebar-accent-foreground": dark ? tifany : darkBlue,
    // charts: blue and green
    "--cf-chart-1": mix(darkBlue, tifany, dark ? 0.55 : 0.32),
    "--cf-chart-2": tifany,
    "--cf-chart-3": mix(ink, page, 0.4),
    // Spectrum components read their own tokens
    "--spectrum-accent-background-color-default": accent,
    "--spectrum-accent-background-color-hover": hover,
    "--spectrum-accent-background-color-down": down,
    "--spectrum-accent-background-color-key-focus": hover,
    "--spectrum-accent-visual-color": accent,
    "--spectrum-accent-content-color-default": dark ? tifany : darkBlue,
    "--spectrum-accent-content-color-hover": dark ? tifany : darkBlue,
    "--spectrum-gray-900": ink,
    "--spectrum-gray-800": mix(ink, page, 0.1),
    "--spectrum-gray-700": mix(ink, page, 0.28),
    "--spectrum-gray-600": mix(ink, page, 0.42),
    "--spectrum-gray-500": borderStrong,
  }
}

export function isBrandTheme(primaryColor: string | undefined) {
  return primaryColor?.toLowerCase() === BRAND.tifany.toLowerCase()
}

/**
 * Variables for the console of a tenant whose primary colour is `primaryColor`.
 * The brand colour selects the full brand theme; any other colour is an accent-only theme.
 */
function withChrome(variables: Record<string, string>, dark: boolean) {
  // In the dark theme the chrome keeps the page colour; white only makes sense on the light theme.
  return WHITE_CHROME_ENABLED && !dark ? { ...variables, "--cf-chrome-bg": BRAND.white } : variables
}

export function getConsoleThemeVariables(primaryColor: string | undefined, dark: boolean): Record<string, string> {
  if (BRAND_PALETTE_ENABLED && (primaryColor === undefined || isBrandTheme(primaryColor))) return withChrome(getBrandPaletteVariables(dark), dark)

  return withChrome(getTenantAccentVariables(primaryColor ?? BRAND.tifany, dark), dark)
}
