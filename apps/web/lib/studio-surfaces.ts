export type SurfacePoint = [number, number]
export type StudioSurface = { id: string; type: "wall" | "floor" | "ceiling"; contours: SurfacePoint[][]; state: "proposed"; confidence?: number }
export type SurfaceAnalysis = { version: 1; imageHash: string; width: number; height: number; model: string; surfaces: StudioSurface[]; warnings: string[]; elapsedMs: number; usage: { promptTokens: number; completionTokens: number; costUsd: number; costSource: "reported" | "calculated" }; analyzedAt: string }

function cross(a: SurfacePoint, b: SurfacePoint, c: SurfacePoint) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) }
export function validateSurfaceContour(points: SurfacePoint[]) {
  if (points.length < 3 || points.length > 2048 || points.some(p => p.length !== 2 || p.some(v => !Number.isFinite(v) || v < 0 || v > 1))) throw new Error("Contorno fora dos limites.")
  if (new Set(points.map(p => p.join(","))).size !== points.length) throw new Error("Contorno com vértices repetidos.")
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    area += a[0] * b[1] - b[0] * a[1]
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue
      const c = points[j], d = points[(j + 1) % points.length]
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) throw new Error("Contorno com auto-interseção.")
    }
  }
  if (Math.abs(area) / 2 < 0.00001) throw new Error("Contorno sem área válida.")
}

// Native Perceptron annotations, not HTML or bounding boxes. One input asset only.
export function parseSurfaceAnnotations(content: string) {
  if (content.length > 200000) throw new Error("Resposta de reconhecimento muito grande.")
  const surfaces = new Map<string, StudioSurface>(), warnings: string[] = []
  let group: Record<string, string> | null = null, polygon: { attrs: Record<string, string>; start: number } | null = null
  const attrs = (value: string) => Object.fromEntries([...value.matchAll(/([\w_]+)\s*=\s*"([^"]*)"/g)].map(m => [m[1], m[2]]))
  for (const tag of content.matchAll(/<\s*(\/?)\s*(collection|polygon|point_box|point)\b([^>]*)>/g)) {
    const closing = Boolean(tag[1]), kind = tag[2], attributes = attrs(tag[3])
    if (kind === "point_box" || kind === "point") { if (!closing) warnings.push("Geometria que não é polígono ignorada."); continue }
    if (kind === "collection") {
      if (polygon || (!closing && group)) throw new Error("Agrupamento de contornos inválido.")
      group = closing ? null : attributes; continue
    }
    if (!closing) { if (polygon) throw new Error("Polígonos aninhados inválidos."); polygon = { attrs: attributes, start: tag.index! + tag[0].length }; continue }
    if (!polygon) throw new Error("Polígono incompleto.")
    const inherited = { ...group, ...polygon.attrs }, id = group?.mention || polygon.attrs.mention || ""
    try {
      if (inherited.asset_idx !== undefined && inherited.asset_idx !== "0") throw new Error("Polígono pertence a outra imagem.")
      const type = /^(wall|floor|ceiling)-[1-9]\d*$/.exec(id)?.[1] as StudioSurface["type"] | undefined
      if (!type) throw new Error("Superfície sem identificação reconhecida.")
      const body = content.slice(polygon.start, tag.index), matches = [...body.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)]
      if (body.replace(/\(\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)/g, "").trim()) throw new Error("Coordenadas inválidas.")
      const points = matches.map(m => [Number(m[1]) / 1000, Number(m[2]) / 1000] as SurfacePoint)
      if (points.length > 1 && points[0].join() === points.at(-1)!.join()) points.pop()
      validateSurfaceContour(points)
      const existing = surfaces.get(id) || { id, type, contours: [], state: "proposed" as const }
      if ((!surfaces.has(id) && surfaces.size >= 20) || existing.contours.length >= 30) throw new Error("Quantidade de superfícies excedida.")
      existing.contours.push(points)
      const confidence = inherited.confidence === undefined ? undefined : Number(inherited.confidence)
      if (confidence !== undefined && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1) existing.confidence = confidence
      surfaces.set(id, existing)
    } catch (error) { warnings.push(`${id || "Sem ID"}: ${error instanceof Error ? error.message : "Contorno inválido."}`) }
    polygon = null
  }
  if (polygon || group) throw new Error("Resposta de reconhecimento incompleta.")
  return { surfaces: [...surfaces.values()], warnings }
}

export function getContainedImageRect(width: number, height: number, imageWidth: number, imageHeight: number) {
  if ([width, height, imageWidth, imageHeight].some(v => !Number.isFinite(v) || v <= 0)) return { left: 0, top: 0, width: 0, height: 0 }
  const scale = Math.min(width / imageWidth, height / imageHeight)
  return { left: (width - imageWidth * scale) / 2, top: (height - imageHeight * scale) / 2, width: imageWidth * scale, height: imageHeight * scale }
}
export function toggleSurfaceSelection(ids: string[], id: string) { return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] }
export function getCurrentSurfaceAnalysis(analysis: (SurfaceAnalysis & { sourceKey: string; tenantSlug: string }) | undefined, sourceKey: string, slug: string) {
  if (!sourceKey || analysis?.sourceKey !== sourceKey || analysis.tenantSlug !== slug) return undefined
  try { validateSurfaceAnalysis(analysis); return analysis } catch { return undefined }
}

export function validateSurfaceAnalysis(value: unknown): asserts value is SurfaceAnalysis {
  const a = value as SurfaceAnalysis
  if (!a || a.version !== 1 || typeof a.imageHash !== "string" || !/^[a-f0-9]{64}$/.test(a.imageHash) || !Number.isFinite(a.width) || !Number.isFinite(a.height) || a.width <= 0 || a.height <= 0 || !Array.isArray(a.surfaces) || a.surfaces.length > 20 || !Array.isArray(a.warnings)) throw new Error("Análise de superfícies inválida.")
  const ids = new Set<string>()
  for (const surface of a.surfaces) {
    if (!/^(wall|floor|ceiling)-[1-9]\d*$/.test(surface.id) || !surface.id.startsWith(surface.type + "-") || surface.state !== "proposed" || ids.has(surface.id) || !Array.isArray(surface.contours) || !surface.contours.length || surface.contours.length > 30) throw new Error("Superfície inválida.")
    ids.add(surface.id); surface.contours.forEach(validateSurfaceContour)
  }
}


export async function getStudioSurfaceSourceKey(mediaUrl: string, versionId = "") {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${mediaUrl}\n${versionId}`))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("")
}

export function describeSelectedStudioPlanes(analysis: (SurfaceAnalysis & { sourceKey: string; tenantSlug: string; sourceVersionId?: string }) | undefined, ids: string[], slug: string, sourceKey: string | undefined, versionId: string) {
  if (!analysis || !sourceKey || analysis.sourceKey !== sourceKey || analysis.tenantSlug !== slug || analysis.sourceVersionId !== versionId) throw new Error("A seleção não corresponde à imagem, versão ou tenant atual. Selecione os planos novamente.")
  validateSurfaceAnalysis(analysis)
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error("Selecione ao menos um plano válido.")
  return ids.map(id => {
    const surface = analysis.surfaces.find(item => item.id === id)
    if (!surface) throw new Error("Plano selecionado não existe nesta análise. Selecione novamente.")
    // Representative anchors identify a plane; they are not a raster mask or exact boundary.
    const area = (points: SurfacePoint[]) => Math.abs(points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - b[0] * a[1] }, 0))
    const points = [...surface.contours].sort((a, b) => area(b) - area(a))[0]
    const count = Math.min(4, points.length)
    const anchors = Array.from({ length: count }, (_, i) => points[Math.floor(i * points.length / count)].map(value => Number(value.toFixed(3))))
    return { id: surface.id, type: surface.type, anchors }
  })
}
