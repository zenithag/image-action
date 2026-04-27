export type TenantBrandingSnapshot = {
  companyName: string
  primaryColor: string
  logoUrl: string
}

function normalizeHex(value: string) {
  const color = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : "#31C48D"
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

export function normalizeTenantBrandingSnapshot(snapshot: Partial<TenantBrandingSnapshot> | null | undefined): TenantBrandingSnapshot {
  return {
    companyName: snapshot?.companyName?.trim() || "Tenant",
    primaryColor: normalizeHex(snapshot?.primaryColor || "#31C48D"),
    logoUrl: snapshot?.logoUrl?.trim() || "",
  }
}
