"use client"

let ready: Promise<void> | null = null

/**
 * Registers the Spectrum 2 theme once, in the browser. Every other Spectrum element waits on this
 * before it is defined: elements ask the nearest `sp-theme` which Spectrum version they are in
 * when they connect, so they must upgrade after `sp-theme` exists or they fall back to Spectrum 1
 * (icons without a Spectrum 1 glyph then draw a generic circle).
 */
export function ensureSpectrumTheme(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      // Fragments first: sp-theme adopts its styles as soon as it is defined.
      await Promise.all([
        // "system" fragment: component sizing and spacing tokens (button padding, heights...).
        import("@spectrum-web-components/theme/src/spectrum-two/core.js"),
        import("@spectrum-web-components/theme/spectrum-two/theme-light.js"),
        import("@spectrum-web-components/theme/spectrum-two/theme-dark.js"),
        import("@spectrum-web-components/theme/spectrum-two/scale-medium.js"),
      ])
      await import("@spectrum-web-components/theme/sp-theme.js")
    })()
  }

  return ready
}
