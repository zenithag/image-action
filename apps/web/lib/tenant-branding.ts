export type TenantBrandingSnapshot = {
  companyName: string
  primaryColor: string
  logoUrl: string
}

/** Theme a tenant starts with when it subscribes: the Como fica.ai brand theme (Tifany accent). */
export const DEFAULT_TENANT_PRIMARY_COLOR = "#01CFB0"

function normalizeHex(value: string) {
  const color = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : DEFAULT_TENANT_PRIMARY_COLOR
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase()
}

function mixHex(base: string, target: string, ratio: number) {
  const left = hexToRgb(base)
  const right = hexToRgb(target)
  const weight = clamp(ratio, 0, 1)

  return rgbToHex(
    left.r + (right.r - left.r) * weight,
    left.g + (right.g - left.g) * weight,
    left.b + (right.b - left.b) * weight
  )
}

function toRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const channels = [r, g, b].map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

/** Text colour that stays readable on a given background (dark ink on light colours, white on dark). */
export function getReadableTextColor(backgroundHex: string) {
  return luminance(normalizeHex(backgroundHex)) > 0.45 ? "#111827" : "#FFFFFF"
}

export function getTenantBrandingVariables(primaryColorInput: string): Record<string, string> {
  const primaryColor = normalizeHex(primaryColorInput)
  const primaryForeground = luminance(primaryColor) > 0.45 ? "#111827" : "#FFFFFF"
  const bubbleOut = mixHex(primaryColor, "#FFFFFF", 0.18)
  const bubbleOutForeground = luminance(bubbleOut) > 0.45 ? "#111827" : "#FFFFFF"

  return {
    "--primary": primaryColor,
    "--ring": primaryColor,
    "--sidebar-primary": primaryColor,
    "--sidebar-ring": primaryColor,
    "--primary-foreground": primaryForeground,
    "--sidebar-primary-foreground": primaryForeground,
    "--sidebar-accent": toRgba(primaryColor, 0.14),
    "--sidebar-accent-foreground": mixHex(primaryColor, "#0F172A", 0.78),
    "--accent": toRgba(primaryColor, 0.1),
    "--accent-foreground": mixHex(primaryColor, "#0F172A", 0.72),
    "--chat-bubble-out": bubbleOut,
    "--chat-bubble-out-foreground": bubbleOutForeground,
  }
}

/**
 * Accent tokens for the console, derived from the tenant's primary colour ("Marca & dados").
 * Sets the Spectrum accent variables (buttons, checkbox, focus...), the soft/ink pair used for
 * selected states, and the shadcn bridge variables, so one colour drives every highlight.
 * In the dark theme a very dark brand colour is lifted so it stays visible on dark surfaces.
 */
export function getTenantAccentVariables(primaryColorInput: string, dark = false): Record<string, string> {
  let accent = normalizeHex(primaryColorInput)
  if (dark && luminance(accent) < 0.16) accent = mixHex(accent, "#FFFFFF", 0.5)

  const hover = dark ? mixHex(accent, "#FFFFFF", 0.14) : mixHex(accent, "#000000", 0.14)
  const down = dark ? mixHex(accent, "#FFFFFF", 0.24) : mixHex(accent, "#000000", 0.26)
  const soft = dark ? mixHex(accent, "#161B22", 0.78) : mixHex(accent, "#FFFFFF", 0.88)
  const softHover = dark ? mixHex(accent, "#161B22", 0.68) : mixHex(accent, "#FFFFFF", 0.78)
  const ink = dark ? mixHex(accent, "#FFFFFF", 0.62) : mixHex(accent, "#000000", 0.55)
  const on = luminance(accent) > 0.45 ? "#111827" : "#FFFFFF"

  return {
    ...getTenantBrandingVariables(accent),
    "--spectrum-accent-background-color-default": accent,
    "--spectrum-accent-background-color-hover": hover,
    "--spectrum-accent-background-color-down": down,
    "--spectrum-accent-background-color-key-focus": hover,
    "--spectrum-accent-visual-color": accent,
    "--spectrum-accent-content-color-default": ink,
    "--spectrum-accent-content-color-hover": ink,
    "--cf-accent": accent,
    "--cf-accent-hover": hover,
    "--cf-accent-soft": soft,
    "--cf-accent-soft-hover": softHover,
    "--cf-accent-ink": ink,
    "--cf-on-accent": on,
    "--cf-brand": accent,
    "--cf-brand-hover": hover,
    "--cf-brand-soft": soft,
    "--cf-brand-ink": ink,
    "--cf-on-brand": on,
    "--cf-focus": accent,
    "--cf-surface-selected": soft,
    "--primary": accent,
    "--primary-foreground": on,
    "--ring": accent,
  }
}

export function normalizeTenantBrandingSnapshot(snapshot: Partial<TenantBrandingSnapshot> | null | undefined): TenantBrandingSnapshot {
  return {
    companyName: snapshot?.companyName?.trim() || "Tenant",
    primaryColor: normalizeHex(snapshot?.primaryColor || DEFAULT_TENANT_PRIMARY_COLOR),
    logoUrl: snapshot?.logoUrl?.trim() || "",
  }
}
