/** Shared geometry for the branding preview and exported composition. */
export type WatermarkSettings = {
  watermarkPosition?: "center" | "bottom-right" | "custom"
  watermarkX?: number
  watermarkY?: number
  watermarkSize?: number
  watermarkOpacity?: number
}

export function normalizeWatermarkPercent(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : fallback
}

export function getWatermarkPlacement(settings: WatermarkSettings) {
  const legacyCorner = settings.watermarkPosition === "bottom-right"
  return {
    x: settings.watermarkPosition === "custom" ? normalizeWatermarkPercent(settings.watermarkX, 50) : legacyCorner ? 97 : 50,
    y: settings.watermarkPosition === "custom" ? normalizeWatermarkPercent(settings.watermarkY, 50) : legacyCorner ? 97 : 50,
    opacity: normalizeWatermarkPercent(settings.watermarkOpacity, 22) / 100,
    scale: Math.min(200, Math.max(50, settings.watermarkSize ?? 100)) / 100,
  }
}

export function getWatermarkBox(width: number, height: number, settings: WatermarkSettings, isLogo = true) {
  const placement = getWatermarkPlacement(settings)
  const boxWidth = Math.max(1, Math.round(Math.min(width, width * (isLogo ? 0.28 : 0.7) * placement.scale)))
  const boxHeight = Math.max(1, Math.round(Math.min(height, height * 0.18 * placement.scale)))
  return {
    width: boxWidth,
    height: boxHeight,
    left: Math.round((width - boxWidth) * placement.x / 100),
    top: Math.round((height - boxHeight) * placement.y / 100),
    opacity: placement.opacity,
  }
}

export function createTextWatermarkSvg(width: number, height: number, settings: WatermarkSettings, text: string) {
  const box = getWatermarkBox(width, height, settings, false)
  const escaped = text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!)
  const fontSize = Math.max(1, Math.min(height * 0.045 * getWatermarkPlacement(settings).scale, box.width / Math.max(1, text.length) / 0.65))
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="${box.left + box.width / 2}" y="${box.top + box.height / 2}" text-anchor="middle" dominant-baseline="middle" fill="white" stroke="black" stroke-width="0.5" paint-order="stroke" opacity="${box.opacity}" font-family="Arial, sans-serif" font-weight="700" font-size="${fontSize}">${escaped}</text></svg>`
}
