import { createHash } from "node:crypto"
import sharp from "sharp"
import { parseSurfaceAnnotations, validateSurfaceAnalysis } from "@/lib/studio-surfaces"
import type { SurfaceAnalysis } from "@/lib/studio-surfaces"
import type { AiProvider } from "@/lib/ai-types"
import { getActiveOpenRouterProvider } from "@/lib/server/ai-providers-store"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

export const SURFACE_MODEL = "perceptron/perceptron-mk1.5"
const pending = new Map<string, Promise<SurfaceAnalysis>>()
export async function recognizeStudioSurfaces(slug: string, bytes: Buffer, options?: { provider?: AiProvider; fetcher?: typeof fetch }) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug) || bytes.length > 8_000_000 || !bytes.length) throw new Error("Imagem ou tenant inválido.")
  const metadata = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata()
  if (!["png", "jpeg", "webp"].includes(metadata.format || "") || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error("Use uma imagem estática PNG, JPEG ou WebP.")
  const normalized = await sharp(bytes, { limitInputPixels: 20_000_000 }).rotate().resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true })
  const imageHash = createHash("sha256").update(bytes).digest("hex")
  const scope = `${slug}:${imageHash}:v1`
  const store = { key: `studio-surfaces:${scope}`, filePath: getRuntimeDataFile(`studio-surfaces/${slug}/${imageHash}.json`), fallback: null as SurfaceAnalysis | null }
  const cached = await readJsonStore(store)
  if (cached?.imageHash === imageHash && cached.version === 1) {
    try { validateSurfaceAnalysis(cached); return cached } catch { /* Invalid cache must be recomputed. */ }
  }
  if (pending.has(scope)) return pending.get(scope)!
  if ([...pending.keys()].some(key => key.startsWith(`${slug}:`))) throw new Error("Reconhecimento já em andamento neste tenant. Aguarde e tente novamente.")
  const task = (async () => {
    const provider = options?.provider || await getActiveOpenRouterProvider()
    if (!provider) throw new Error("Nenhum provider OpenRouter ativo disponível.")
    const started = Date.now()
    const response = await (options?.fetcher || fetch)(`${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", "X-Title": "ComoFica" }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ model: SURFACE_MODEL, annotation_format: "polygon", vision_config: { annotation_format: "polygon" }, max_tokens: 4096, temperature: 0, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/webp;base64,${normalized.data.toString("base64")}` } }, { type: "text", text: "Identify the distinct visible architectural PLANES: each physical wall, floor and ceiling, including diagonal walls in perspective. This is approximate plane localization for user selection, NOT pixel segmentation. Return ONE simple representative polygon with 3 to 8 vertices for each physical plane, in its own collection. The polygon identifies the plane and need not cover every visible pixel or cut around furniture, doors, windows or lights. Do not subdivide a single wall around occlusions. Do not invent hidden planes. Omit a plane if uncertain. Use collection mention exactly wall-1, wall-2, floor-1, ceiling-1 etc and asset_idx 0. Coordinates are normalized 0..1000. Keep plane identities distinct; do not combine perpendicular walls. No JSON, no markdown, only native collection/polygon annotation markup. This is approximate localization, NOT image generation or an exact editing mask." }] }] }),
    })
    if (!response.ok) throw new Error(`Reconhecimento indisponível (HTTP ${response.status}). Tente novamente.`)
    let payload
    try {
      payload = await response.json()
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Invalid response shape")
    } catch {
      console.warn("[studio-surfaces] invalid-provider-response", { stage: "json", elapsedMs: Date.now() - started })
      throw new Error("O modelo retornou uma resposta ilegível. Nenhum contorno foi aplicado.")
    }
    const choice = payload.choices?.[0]
    if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string" || !choice.message.content.trim()) {
      const reason = choice?.finish_reason === "stop" ? "empty" : ["length", "content_filter", "tool_calls", "error"].includes(choice?.finish_reason) ? choice.finish_reason : "missing-or-unknown"
      // Log metadata only: never the response text, input raster, provider key or URL.
      console.warn("[studio-surfaces] incomplete-response", { reason, elapsedMs: Date.now() - started, promptTokens: Number(payload.usage?.prompt_tokens) || 0, completionTokens: Number(payload.usage?.completion_tokens) || 0 })
      if (reason === "length") throw new Error("O modelo atingiu o limite de saída antes de concluir os contornos. A análise incompleta não foi aplicada.")
      if (reason === "content_filter") throw new Error("O modelo interrompeu o reconhecimento por um filtro do provedor.")
      throw new Error("O modelo não concluiu o reconhecimento ou retornou uma resposta vazia. A imagem foi preservada.")
    }
    let parsed
    try { parsed = parseSurfaceAnnotations(choice.message.content) }
    catch {
      console.warn("[studio-surfaces] invalid-provider-response", { stage: "annotations", elapsedMs: Date.now() - started, promptTokens: Number(payload.usage?.prompt_tokens) || 0, completionTokens: Number(payload.usage?.completion_tokens) || 0 })
      throw new Error("O modelo retornou contornos incompletos ou em formato inválido. Nenhum contorno foi aplicado.")
    }
    const promptTokens = Number(payload.usage?.prompt_tokens) || 0, completionTokens = Number(payload.usage?.completion_tokens) || 0
    const reported = payload.usage?.cost
    const result: SurfaceAnalysis = { version: 1, imageHash, width: normalized.info.width, height: normalized.info.height, model: SURFACE_MODEL, ...parsed, elapsedMs: Date.now() - started, usage: { promptTokens, completionTokens, costUsd: typeof reported === "number" && Number.isFinite(reported) ? reported : promptTokens * 0.15 / 1_000_000 + completionTokens * 1.5 / 1_000_000, costSource: typeof reported === "number" && Number.isFinite(reported) ? "reported" : "calculated" }, analyzedAt: new Date().toISOString() }
    await writeJsonStore(store, result)
    return result
  })()
  pending.set(scope, task)
  try { return await task } finally { pending.delete(scope) }
}
