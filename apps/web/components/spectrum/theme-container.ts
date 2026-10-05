/** Radix portals default to <body>, outside <sp-theme>; render them inside it so Spectrum tokens apply. */
export function getThemeContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined
  return document.querySelector<HTMLElement>("sp-theme.cf-panel") ?? undefined
}
