import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

import type { AiProvider } from "@/lib/ai-types"
import type { CompositionJob, CompositionJobReference } from "@/lib/composition-types"
import { getAiModelProfile } from "@/lib/server/ai-model-profiles-store"
import { getActiveOpenRouterProvider } from "@/lib/server/ai-providers-store"
import { listCatalogItems } from "@/lib/server/catalog-store"
import { saveGeneratedAsset } from "@/lib/server/generated-assets-store"
import { findInboxMessage, listInboxMessages } from "@/lib/server/inbox-store"
import { requestSegmentationMask, type SegmentationTarget } from "@/lib/server/segmentation-service-client"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { getRuntimeGeneratedDir } from "@/lib/server/runtime-paths"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { resolveWhatsAppMedia } from "@/lib/server/whatsapp-media"

type OpenRouterImageChoice = {
  finish_reason?: unknown
  native_finish_reason?: unknown
  message?: {
    content?: unknown
    images?: unknown
  }
}

type OpenRouterImageResponse = {
  id?: string
  model?: string
  choices?: OpenRouterImageChoice[]
  error?: {
    message?: string
  } | string
  usage?: unknown
}

type BaseImage = {
  dataUrl: string
  bytes: Buffer
  mimeType: string
  width: number
  height: number
}
type SegmentationImage = BaseImage & {
  scale: number
}

type SurfaceMask = {
  polygons: Array<{
    label?: string
    points: Array<[number, number]>
  }>
  maskDataUrl?: string
  confidence?: number
  provider?: string
  model?: string | null
}
type GeneratedImage = {
  bytes: Buffer
  mimeType: string
  model: string
}
type RgbColor = {
  r: number
  g: number
  b: number
}

const outputDir = getRuntimeGeneratedDir("compositions")
const supportedAspectRatios = [
  { value: "1:1", ratio: 1 },
  { value: "2:3", ratio: 2 / 3 },
  { value: "3:2", ratio: 3 / 2 },
  { value: "3:4", ratio: 3 / 4 },
  { value: "4:3", ratio: 4 / 3 },
  { value: "4:5", ratio: 4 / 5 },
  { value: "5:4", ratio: 5 / 4 },
  { value: "9:16", ratio: 9 / 16 },
  { value: "16:9", ratio: 16 / 9 },
  { value: "21:9", ratio: 21 / 9 },
] as const
const environmentStructureGuardrail = [
  "REGRA OBRIGATORIA DE PRESERVACAO DO AMBIENTE:",
  "A imagem recebida e a base estrutural fixa. Nao modifique angulo de camera, perspectiva, enquadramento, layout, arquitetura, posicao de paredes, janelas, portas, teto, piso ou aberturas.",
  "Nao remova, nao desloque e nao redesenhe janelas, portas, quinas, vigas, sancas, rodapes, tomadas ou outros elementos estruturais existentes.",
  "Pode modificar somente os itens explicitamente solicitados: cor de parede, piso, teto, revestimentos, moveis, decoracao e objetos dentro do ambiente.",
  "Se o pedido for trocar cor de parede, aplique apenas a nova cor na parede indicada, mantendo textura, sombras, luz natural, objetos, aberturas e geometria originais.",
  "Preserve o quadro completo da foto original. Nao recorte, nao expanda, nao centralize novamente e nao transforme a imagem em formato quadrado.",
].join("\n")
const surfaceSegmentationGuardrail = [
  "REGRA OBRIGATORIA DE SEGMENTACAO DO AMBIENTE:",
  "Antes de editar, identifique mentalmente as superficies: paredes, parede do fundo, parede esquerda, parede direita, teto, piso, portas, janelas, rodapes, moveis e objetos.",
  "Quando o cliente pedir parede sem restricao de lado, aplique a alteracao em todas as paredes visiveis do ambiente: parede do fundo, paredes laterais, parede esquerda e parede direita quando existirem no enquadramento.",
  "Quando o cliente disser lado direito, lado esquerdo, parede do fundo, teto ou piso, altere somente essa superficie indicada e preserve todas as outras superficies.",
  "Nunca pinte portas, janelas, vidro, piso, teto, moveis ou objetos quando o pedido for apenas parede.",
].join("\n")
const defaultImageFallbackModel = "google/gemini-3-pro-image-preview"

function appendPath(baseUrl: string, pathname: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${pathname.replace(/^\/+/, "")}`
}

function getOpenRouterHeaders(provider: AiProvider) {
  return {
    Authorization: `Bearer ${provider.apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_SITE_NAME || "ComoFica",
    "X-OpenRouter-Title": process.env.OPENROUTER_SITE_NAME || "ComoFica",
  }
}

function getOpenRouterImageSize() {
  const value = process.env.OPENROUTER_IMAGE_SIZE?.trim()

  if (!value || value === "1024x1024") {
    return "1K"
  }

  return value
}

function getOpenRouterImageQuality() {
  return process.env.OPENROUTER_IMAGE_QUALITY?.trim() || "medium"
}

function getOpenRouterImageOutputFormat() {
  return process.env.OPENROUTER_IMAGE_OUTPUT_FORMAT?.trim() || "png"
}

function shouldUseLocalSurfaceRender() {
  return process.env.USE_LOCAL_SURFACE_RENDER === "true"
}

function getExtension(mimeType: string) {
  if (mimeType.includes("webp")) return "webp"
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg"
  return "png"
}

function getFileName(job: CompositionJob, mimeType: string) {
  const attempt = Math.max(1, job.processingAttempts || 1)

  return `${job.id}-attempt-${attempt}.${getExtension(mimeType)}`
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

async function applyTenantWatermark(job: CompositionJob, imageBytes: Buffer) {
  const settings = await getTenantSettings(job.tenantSlug)
  const branding = settings.branding

  if (!branding.watermarkEnabled) {
    return imageBytes
  }

  const text = (branding.watermarkText || settings.general.companyName || "ComoFica").trim()
  if (!text) {
    return imageBytes
  }

  const metadata = await sharp(imageBytes).metadata()
  const width = metadata.width ?? 1280
  const height = metadata.height ?? 720
  const fontSize = Math.max(20, Math.round(Math.min(width, height) * (branding.watermarkPosition === "center" ? 0.045 : 0.028)))
  const padding = Math.max(24, Math.round(Math.min(width, height) * 0.03))
  const escapedText = escapeSvgText(text)

  const overlaySvg = branding.watermarkPosition === "bottom-right"
    ? `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <style>
          .wm { fill: rgba(255,255,255,0.26); font-family: Arial, sans-serif; font-weight: 700; font-size: ${fontSize}px; letter-spacing: 0.18em; text-transform: uppercase; }
          .bg { fill: rgba(0,0,0,0.10); rx: 12px; ry: 12px; }
        </style>
        <g transform="translate(${width - padding}, ${height - padding})">
          <rect class="bg" x="-${Math.round((escapedText.length + 8) * fontSize * 0.48)}" y="-${Math.round(fontSize * 1.55)}" width="${Math.round((escapedText.length + 6) * fontSize * 0.58)}" height="${Math.round(fontSize * 1.9)}" />
          <text class="wm" text-anchor="end" dominant-baseline="ideographic"> ${escapedText} </text>
        </g>
      </svg>
    `
    : `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <style>
          .wm { fill: rgba(255,255,255,0.22); stroke: rgba(0,0,0,0.12); stroke-width: 1; paint-order: stroke; font-family: Arial, sans-serif; font-weight: 700; font-size: ${fontSize}px; letter-spacing: 0.22em; text-transform: uppercase; }
        </style>
        <g transform="translate(${width / 2}, ${height / 2}) rotate(-14)">
          <text class="wm" text-anchor="middle" dominant-baseline="middle">${escapedText}</text>
        </g>
      </svg>
    `

  return sharp(imageBytes)
    .composite([{ input: Buffer.from(overlaySvg) }])
    .png()
    .toBuffer()
}

function getTargetSurfaceInstruction(job: CompositionJob) {
  const prompt = normalizeText(job.prompt)
  const productName = normalizeText(job.catalogItemName || "")
  const asksWall = (
    prompt.includes("parede") ||
    prompt.includes("pint") ||
    prompt.includes("tinta") ||
    productName.includes("tinta")
  )

  if (prompt.includes("lado direito") || prompt.includes("parede direita") || prompt.includes("direita")) {
    return "Superficie alvo detectada: somente a parede ou area do lado direito visivel na imagem. Preserve parede esquerda, parede do fundo, teto, piso, portas, janelas, moveis e objetos."
  }

  if (prompt.includes("lado esquerdo") || prompt.includes("parede esquerda") || prompt.includes("esquerda")) {
    return "Superficie alvo detectada: somente a parede ou area do lado esquerdo visivel na imagem. Preserve parede direita, parede do fundo, teto, piso, portas, janelas, moveis e objetos."
  }

  if (prompt.includes("parede do fundo") || prompt.includes("fundo")) {
    return "Superficie alvo detectada: somente a parede do fundo. Preserve paredes laterais, teto, piso, portas, janelas, moveis e objetos."
  }

  if ((prompt.includes("piso") || prompt.includes("chao")) && !prompt.includes("parede")) {
    return "Superficie alvo detectada: somente o piso/chao. Nao altere paredes, teto, portas, janelas, moveis ou objetos."
  }

  if (prompt.includes("teto") && !prompt.includes("parede")) {
    return "Superficie alvo detectada: somente o teto. Nao altere paredes, piso, portas, janelas, moveis ou objetos."
  }

  if (asksWall) {
    return [
      "Superficie alvo detectada: todas as paredes visiveis no enquadramento.",
      "Aplique a alteracao na parede do fundo e tambem nas paredes laterais visiveis, incluindo parede esquerda e parede direita quando aparecerem na imagem.",
      "Pinte cada parede ate seus limites reais com teto, piso, portas, janelas, rodapes, cortinas, moveis e objetos, sem pintar esses elementos.",
      "Se houver duas ou mais paredes visiveis, todas devem receber a mesma cor/material solicitado, salvo se o cliente pedir explicitamente apenas um lado.",
    ].join(" ")
  }

  return ""
}

function getRequestedSurface(job: CompositionJob) {
  const prompt = normalizeText(job.prompt)
  const productName = normalizeText(job.catalogItemName || "")

  if ((prompt.includes("piso") || prompt.includes("chao")) && !prompt.includes("parede")) {
    return "floor" as const
  }

  if (prompt.includes("teto") && !prompt.includes("parede")) {
    return "ceiling" as const
  }

  if (
    prompt.includes("parede") ||
    prompt.includes("pint") ||
    prompt.includes("tinta") ||
    productName.includes("tinta")
  ) {
    return "painted_wall" as const
  }

  return null
}

function getSegmentationTarget(job: CompositionJob): SegmentationTarget {
  const surface = getRequestedSurface(job)

  if (surface === "floor") return "floor"
  if (surface === "ceiling") return "ceiling"

  return "painted_wall"
}

async function isLocalizedSurfaceColorRequest(job: CompositionJob) {
  return Boolean(getRequestedSurface(job)) && (
    Boolean(await getRequestedPaintColor(job)) ||
    Boolean(job.catalogItemId) ||
    Boolean(job.catalogItemName)
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(value: string): RgbColor | null {
  const match = value.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/)

  if (!match) {
    return null
  }

  const hex = match[1].length === 3
    ? match[1].split("").map((char) => `${char}${char}`).join("")
    : match[1]

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function parseRgbColor(value: string): RgbColor | null {
  const match = value.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/i)

  if (!match) {
    return null
  }

  return {
    r: clamp(Number(match[1]), 0, 255),
    g: clamp(Number(match[2]), 0, 255),
    b: clamp(Number(match[3]), 0, 255),
  }
}

function parseCmykColor(value: string): RgbColor | null {
  const match = value.match(/cmyk\(\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*\)/i)

  if (!match) {
    return null
  }

  const [c, m, y, k] = match.slice(1).map((part) => clamp(Number(part), 0, 100) / 100)

  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  }
}

function parseColorReference(value?: string | null): RgbColor | null {
  if (!value) {
    return null
  }

  return parseHexColor(value) || parseRgbColor(value) || parseCmykColor(value)
}

async function getCatalogItem(job: CompositionJob) {
  if (!job.catalogItemId && !job.catalogItemName) {
    return null
  }

  const items = await listCatalogItems(job.tenantSlug)
  const normalizedName = normalizeText(job.catalogItemName || "")

  return items.find((catalogItem) => catalogItem.id === job.catalogItemId) ||
    items.find((catalogItem) => normalizeText(catalogItem.name) === normalizedName) ||
    null
}

async function getRequestedPaintColor(job: CompositionJob): Promise<RgbColor | null> {
  const catalogItem = await getCatalogItem(job)
  const catalogText = catalogItem
    ? [
        catalogItem.description,
        ...Object.values(catalogItem.tags || {}),
      ].filter(Boolean).join(" ")
    : ""

  return parseColorReference(job.catalogColorReference) ||
    parseColorReference(catalogText) ||
    parseColorReference(job.prompt)
}

function getFallbackSurfaceColor(job: CompositionJob, surface: string | null): RgbColor {
  const source = normalizeText([
    job.catalogItemName,
    job.prompt,
  ].filter(Boolean).join(" "))

  if (source.includes("carrara") || source.includes("marmore") || source.includes("porcelanato")) {
    return { r: 222, g: 220, b: 214 }
  }

  if (source.includes("madeira") || source.includes("amadeirado")) {
    return { r: 154, g: 109, b: 70 }
  }

  if (source.includes("cimento") || source.includes("concreto")) {
    return { r: 150, g: 148, b: 142 }
  }

  if (source.includes("branco")) {
    return { r: 236, g: 234, b: 228 }
  }

  if (source.includes("cinza")) {
    return { r: 172, g: 169, b: 162 }
  }

  if (surface === "floor") {
    return { r: 205, g: 201, b: 194 }
  }

  return { r: 218, g: 214, b: 204 }
}

function getFrameInstruction(baseImage: BaseImage) {
  return [
    `A imagem final deve ocupar 100% do quadro original ${baseImage.width}x${baseImage.height}.`,
    `Use a proporcao ${getClosestAspectRatio(baseImage.width, baseImage.height)} do inicio ao fim.`,
    "Nao gere uma imagem quadrada no centro de um canvas maior.",
    "Nao use a foto original como borda ou fundo visivel. A composicao editada deve preencher toda a largura e toda a altura.",
  ].join("\n")
}

function firstJsonObject(value: string) {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Resposta de mascara nao contem JSON.")
  }

  return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>
}

function isNormalizedPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1]) &&
    value[0] >= 0 &&
    value[0] <= 1 &&
    value[1] >= 0 &&
    value[1] <= 1
}

function normalizeSurfaceMask(value: unknown): SurfaceMask {
  const record = typeof value === "object" && value ? value as Record<string, unknown> : {}
  const polygons = Array.isArray(record.polygons) ? record.polygons : []
  const normalizedPolygons = polygons
    .map((polygon) => {
      const polygonRecord = typeof polygon === "object" && polygon ? polygon as Record<string, unknown> : {}
      const points = Array.isArray(polygonRecord.points) ? polygonRecord.points.filter(isNormalizedPoint) : []

      return {
        label: typeof polygonRecord.label === "string" ? polygonRecord.label : undefined,
        points,
      }
    })
    .filter((polygon) => polygon.points.length >= 3)

  return {
    polygons: normalizedPolygons,
    confidence: typeof record.confidence === "number" ? Math.min(1, Math.max(0, record.confidence)) : undefined,
  }
}

function polygonArea(points: Array<[number, number]>) {
  let area = 0

  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[(index + 1) % points.length]

    area += x1 * y2 - x2 * y1
  }

  return Math.abs(area) / 2
}

function polygonBounds(points: Array<[number, number]>) {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function validateSurfaceMask(mask: SurfaceMask, job: CompositionJob) {
  if (mask.maskDataUrl) {
    if (typeof mask.confidence === "number" && mask.confidence < 0.45) {
      throw new Error("A mascara da superficie ficou com baixa confianca. Preciso de uma selecao mais precisa antes de aplicar a composicao.")
    }

    return
  }

  if (mask.polygons.length === 0) {
    throw new Error("Nao foi possivel identificar area editavel com seguranca.")
  }

  if (typeof mask.confidence === "number" && mask.confidence < 0.45) {
    throw new Error("A mascara da superficie ficou com baixa confianca. Preciso de uma selecao mais precisa antes de aplicar a composicao.")
  }

  const totalArea = mask.polygons.reduce((sum, polygon) => sum + polygonArea(polygon.points), 0)
  const largestPolygon = [...mask.polygons].sort((left, right) => polygonArea(right.points) - polygonArea(left.points))[0]
  const largestBounds = polygonBounds(largestPolygon.points)
  const largestBoundsArea = (largestBounds.maxX - largestBounds.minX) * (largestBounds.maxY - largestBounds.minY)
  const largestFillRatio = largestBoundsArea > 0 ? polygonArea(largestPolygon.points) / largestBoundsArea : 0
  const prompt = normalizeText(job.prompt)
  const needsOcclusionPrecision = [
    "azulejo",
    "revest",
    "pia",
    "tanque",
    "maquina",
    "movel",
    "objeto",
    "porta",
    "janela",
  ].some((term) => prompt.includes(term))

  if (totalArea > 0.18 && largestPolygon.points.length <= 4 && largestFillRatio > 0.82) {
    throw new Error("A mascara retornada parece um retangulo grosseiro. Recusei aplicar para nao pintar moveis, revestimentos ou objetos.")
  }

  if (needsOcclusionPrecision && mask.polygons.every((polygon) => polygon.points.length <= 5)) {
    throw new Error("A mascara nao contornou obstaculos/revestimentos com precisao suficiente. Recusei aplicar para preservar a imagem original.")
  }
}

function getMaskExcludeList(job: CompositionJob) {
  const surface = getRequestedSurface(job)

  if (surface === "floor") {
    return ["walls", "ceiling", "furniture", "objects", "people", "appliances", "shadows"]
  }

  if (surface === "ceiling") {
    return ["walls", "floor", "doors", "windows", "furniture", "objects", "lighting fixtures"]
  }

  return [
    "tiles",
    "ceramic wall covering",
    "stone covering",
    "doors",
    "windows",
    "glass",
    "floor",
    "ceiling",
    "baseboards",
    "furniture",
    "appliances",
    "sink",
    "fixtures",
    "objects",
    "people",
    "object shadows",
  ]
}

async function prepareImageForSegmentation(baseImage: BaseImage): Promise<SegmentationImage> {
  const longestSide = Math.max(baseImage.width, baseImage.height)
  const targetLongestSide = longestSide < 1200 ? 1600 : longestSide < 1800 ? 1800 : longestSide
  const scale = clamp(targetLongestSide / longestSide, 1, 2)
  const width = Math.round(baseImage.width * scale)
  const height = Math.round(baseImage.height * scale)
  const bytes = await sharp(baseImage.bytes)
    .rotate()
    .resize(width, height, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .gamma(1.03)
    .modulate({ brightness: 1.03, saturation: 1.04 })
    .linear(1.08, -6)
    .sharpen({ sigma: 0.9, m1: 0.72, m2: 0.32 })
    .png()
    .toBuffer()

  return {
    dataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
    bytes,
    mimeType: "image/png",
    width,
    height,
    scale,
  }
}

async function requestExternalSurfaceMask(job: CompositionJob, baseImage: BaseImage): Promise<SurfaceMask | null> {
  const segmentationImage = await prepareImageForSegmentation(baseImage)
  const result = await requestSegmentationMask({
    image: segmentationImage.dataUrl,
    target: getSegmentationTarget(job),
    prompt: job.prompt,
    exclude: getMaskExcludeList(job),
    width: segmentationImage.width,
    height: segmentationImage.height,
  })

  if (!result) {
    return null
  }

  return {
    polygons: [],
    maskDataUrl: result.mask || undefined,
    confidence: typeof result.confidence === "number" ? result.confidence : undefined,
    provider: result.provider,
    model: [result.model, segmentationImage.scale > 1 ? `analysis-upscale-${segmentationImage.scale.toFixed(2)}x` : null]
      .filter(Boolean)
    .join("+") || null,
  }
}

async function requestExternalForegroundMask(job: CompositionJob, baseImage: BaseImage): Promise<SurfaceMask | null> {
  const segmentationImage = await prepareImageForSegmentation(baseImage)
  const result = await requestSegmentationMask({
    image: segmentationImage.dataUrl,
    target: "foreground_objects",
    prompt: [
      job.prompt,
      "Selecione moveis, sofa, poltronas, mesas, cadeiras, cortinas, luminarias, plantas, vasos, portas, janelas, eletrodomesticos e objetos que devem ficar exatamente iguais por cima da superficie renderizada.",
    ].join("\n"),
    exclude: ["painted wall", "bare wall", "floor", "ceiling"],
    width: segmentationImage.width,
    height: segmentationImage.height,
  })

  if (!result) {
    return null
  }

  return {
    polygons: [],
    maskDataUrl: result.mask || undefined,
    confidence: typeof result.confidence === "number" ? result.confidence : undefined,
    provider: result.provider,
    model: [result.model, segmentationImage.scale > 1 ? `foreground-upscale-${segmentationImage.scale.toFixed(2)}x` : null]
      .filter(Boolean)
      .join("+") || null,
  }
}

function getWallMaskPrompt(job: CompositionJob, baseImage: BaseImage) {
  const targetSurface = getRequestedSurface(job) || "painted_wall"
  const targetLabel = targetSurface === "floor"
    ? "piso/chao"
    : targetSurface === "ceiling"
      ? "teto"
      : "parede pintada"
  return [
    "Analise a imagem e retorne SOMENTE JSON valido.",
    `A imagem tem ${baseImage.width}x${baseImage.height}. Use coordenadas normalizadas entre 0 e 1.`,
    `Objetivo: identificar exatamente a superficie editavel solicitada: ${targetLabel}.`,
    "Desenhe uma mascara precisa da superficie real, nao uma caixa delimitadora.",
    "Use poligonos detalhados com pontos suficientes para contornar objetos, moveis, pia, tanque, maquina, portas, janelas, revestimentos e outras oclusoes.",
    "Nao use retangulos grosseiros. Se a area tiver obstaculos na frente, recorte a mascara ao redor desses obstaculos.",
    "Inclua somente partes que podem receber a alteracao solicitada.",
    "Para parede: inclua somente parede pintada/rebocada; exclua revestimentos, azulejos, ceramicas, pedras, portas, janelas, vidros, piso, teto, rodapes, moveis, eletrodomesticos, loucas, metais, objetos, sombras de objetos e pessoas.",
    "Para piso: inclua somente o piso visivel; exclua paredes, moveis, objetos e sombras de objetos.",
    "Para teto: inclua somente o teto visivel; exclua paredes, luminarias, sancas destacadas, portas e janelas.",
    "Se parte da parede tem revestimento e outra parte e pintada, inclua apenas a parte pintada.",
    "Se o cliente pedir lado direito, esquerdo ou fundo, inclua somente essa area. Se pedir parede sem lado especifico, inclua toda a area visivel de parede pintavel.",
    getTargetSurfaceInstruction(job),
    `Briefing: ${job.prompt}`,
    "Formato obrigatorio: {\"polygons\":[{\"label\":\"painted_wall\",\"points\":[[0.12,0.21],[0.27,0.2],[0.29,0.42],[0.23,0.43],[0.23,0.58],[0.12,0.59]]}],\"confidence\":0.8}",
    "Use label painted_wall, floor ou ceiling.",
    "Se nao houver area editavel clara ou se voce so conseguir uma caixa retangular grosseira, retorne {\"polygons\":[],\"confidence\":0}.",
  ].filter(Boolean).join("\n")
}

async function requestWallMask(provider: AiProvider, job: CompositionJob, baseImage: BaseImage) {
  const profile = await getAiModelProfile("vision")
  const model = process.env.OPENROUTER_MASK_MODEL?.trim() || "anthropic/claude-sonnet-4.5"
  const fallbackModelIds = profile?.fallbackModelIds ?? []
  const response = await fetch(appendPath(provider.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: getOpenRouterHeaders(provider),
    body: JSON.stringify({
      model,
      models: fallbackModelIds.length > 0 ? fallbackModelIds : undefined,
      route: fallbackModelIds.length > 0 ? "fallback" : undefined,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: getWallMaskPrompt(job, baseImage) },
            { type: "image_url", image_url: { url: baseImage.dataUrl, detail: "high" } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1800,
      user: job.tenantSlug,
    }),
    signal: AbortSignal.timeout(60000),
  })
  const payload = await response.json().catch(() => null) as OpenRouterImageResponse | null

  if (!response.ok) {
    throw new Error(getOpenRouterError(response.status, payload))
  }

  const rawContent = payload?.choices?.[0]?.message?.content
  const content = typeof rawContent === "string"
    ? rawContent.trim()
    : collectPayloadText(rawContent).join(" ").trim()

  if (!content) {
    throw new Error("Modelo de visao nao retornou mascara de parede.")
  }

  return {
    mask: normalizeSurfaceMask(firstJsonObject(content)),
    model: payload?.model || model,
  }
}

function createMaskSvg(mask: SurfaceMask, baseImage: BaseImage) {
  const polygons = mask.polygons.map((polygon) => {
    const points = polygon.points
      .map(([x, y]) => `${Math.round(x * baseImage.width)},${Math.round(y * baseImage.height)}`)
      .join(" ")

    return `<polygon points="${points}" fill="white"/>`
  }).join("")

  return Buffer.from([
    `<svg xmlns="http://www.w3.org/2000/svg" width="${baseImage.width}" height="${baseImage.height}" viewBox="0 0 ${baseImage.width} ${baseImage.height}">`,
    `<rect width="100%" height="100%" fill="black"/>`,
    polygons,
    "</svg>",
  ].join(""))
}

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)

  if (!match) {
    throw new Error("Servico de segmentacao retornou data URL de mascara invalida.")
  }

  return Buffer.from(match[2], "base64")
}

async function createMaskBuffer(mask: SurfaceMask, baseImage: BaseImage) {
  if (mask.maskDataUrl) {
    return sharp(dataUrlToBuffer(mask.maskDataUrl))
      .resize(baseImage.width, baseImage.height, { fit: "fill" })
      .greyscale()
      .png()
      .toBuffer()
  }

  return createMaskSvg(mask, baseImage)
}

async function validateRasterMask(mask: SurfaceMask, baseImage: BaseImage) {
  if (!mask.maskDataUrl) {
    return
  }

  const raw = await sharp(await createMaskBuffer(mask, baseImage))
    .greyscale()
    .raw()
    .toBuffer()
  const selectedPixels = raw.reduce((sum, value) => sum + (value > 20 ? 1 : 0), 0)
  const coverage = selectedPixels / raw.length

  if (coverage < 0.002) {
    throw new Error("A mascara do servico de segmentacao ficou pequena demais para aplicar a composicao.")
  }

  if (coverage > 0.85) {
    throw new Error("A mascara do servico de segmentacao selecionou area demais. Recusei aplicar para preservar a imagem original.")
  }
}

function pixelLuminance(red: number, green: number, blue: number) {
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function pixelSaturation(red: number, green: number, blue: number) {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)

  if (max <= 0) {
    return 0
  }

  return (max - min) / max
}

function deterministicNoise(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453

  return value - Math.floor(value)
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1)

  return t * t * (3 - 2 * t)
}

async function normalizeReferenceImageUrl(imageUrl: string) {
  if (isSupportedOpenRouterReferenceImage(imageUrl)) {
    return imageUrl
  }

  const image = await bytesFromImageUrl(toAbsoluteImageUrl(imageUrl), "imagem de referencia")
  const isNativeImage = /^image\/(?:png|jpe?g|webp)$/i.test(image.mimeType)

  if (isNativeImage) {
    return `data:${image.mimeType};base64,${image.bytes.toString("base64")}`
  }

  const pngBytes = await sharp(image.bytes).png().toBuffer()
  return `data:image/png;base64,${pngBytes.toString("base64")}`
}

async function getCatalogItemForReference(job: CompositionJob, reference: CompositionJobReference) {
  if (!reference.catalogItemId && !reference.catalogItemName && !reference.catalogSku) {
    return null
  }

  const items = await listCatalogItems(job.tenantSlug)
  const normalizedName = normalizeText(reference.catalogItemName || "")
  const normalizedSku = normalizeText(reference.catalogSku || "")

  return items.find((catalogItem) => catalogItem.id === reference.catalogItemId) ||
    items.find((catalogItem) => normalizeText(catalogItem.sku || "") === normalizedSku) ||
    items.find((catalogItem) => normalizeText(catalogItem.name) === normalizedName) ||
    null
}

async function resolveReferenceMaterialImage(job: CompositionJob, reference: CompositionJobReference) {
  if (reference.source === "inbox" && reference.messageId) {
    const message = await findInboxMessage(job.tenantSlug, job.conversationId, reference.messageId)

    if (message?.contentType === "image") {
      const media = await resolveWhatsAppMedia(message)
      return `data:${media.mimeType};base64,${media.bytes.toString("base64")}`
    }
  }

  if (reference.source === "catalog") {
    const item = await getCatalogItemForReference(job, reference)

    if (item?.imageUrl) {
      return normalizeReferenceImageUrl(item.imageUrl)
    }
  }

  if (reference.imageUrl) {
    return normalizeReferenceImageUrl(reference.imageUrl)
  }

  return null
}

async function resolveLegacyMaterialImage(job: CompositionJob) {
  if (job.referenceMessageId) {
    try {
      const message = await findInboxMessage(job.tenantSlug, job.conversationId, job.referenceMessageId)

      if (message?.contentType === "image") {
        const media = await resolveWhatsAppMedia(message)
        return `data:${media.mimeType};base64,${media.bytes.toString("base64")}`
      }
    } catch {
      // Reference images are optional. The composition can still use the text prompt.
    }
  }

  if (job.referenceImageUrl) {
    try {
      const image = await bytesFromImageUrl(toAbsoluteImageUrl(job.referenceImageUrl), "imagem de referencia")
      return `data:${image.mimeType};base64,${image.bytes.toString("base64")}`
    } catch {
      // Reference images are optional. The composition can still use the text prompt.
    }
  }

  const item = await getCatalogItem(job)

  return item?.imageUrl || null
}

async function getCatalogMaterialImages(job: CompositionJob) {
  const references = job.references ?? []
  const images: string[] = []

  for (const reference of references) {
    try {
      const image = await resolveReferenceMaterialImage(job, reference)
      if (image && isSupportedOpenRouterReferenceImage(image) && !images.includes(image)) {
        images.push(image)
      }
    } catch {
      // Individual references are optional. Keep the job processable with the remaining ones.
    }
  }

  if (images.length === 0) {
    const legacyImage = await resolveLegacyMaterialImage(job)
    const normalizedLegacyImage = legacyImage ? await normalizeReferenceImageUrl(legacyImage).catch(() => null) : null

    if (normalizedLegacyImage && isSupportedOpenRouterReferenceImage(normalizedLegacyImage)) {
      images.push(normalizedLegacyImage)
    }
  }

  return images
}

async function getCatalogMaterialImage(job: CompositionJob) {
  return (await getCatalogMaterialImages(job))[0] ?? null
}

function isSupportedOpenRouterReferenceImage(imageUrl: string | null) {
  if (!imageUrl) {
    return false
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return true
  }

  return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(imageUrl)
}

function getReferenceImageInstruction(referenceImageCount: number) {
  if (referenceImageCount <= 0) {
    return ""
  }

  return [
    "A resposta obrigatoriamente deve conter uma nova imagem gerada no campo message.images. Nao responda apenas com texto.",
    "Use a primeira imagem como foto do ambiente.",
    referenceImageCount === 1
      ? "Use a segunda imagem como referencia visual obrigatoria e exata do produto/material a aplicar."
      : `Use as ${referenceImageCount} imagens seguintes como referencias visuais obrigatorias para montar a composicao final.`,
    "Quando houver varias referencias, combine todas conforme o briefing: uma pode representar material, outra produto, outra textura, outra movel ou objeto.",
    "Para revestimentos, replique fielmente o padrao geometrico, a orientacao, a cor, o relevo, a paginacao, as juntas, a escala relativa e o acabamento da imagem de referencia correspondente.",
    "Trate imagens de textura/revestimento como modulos/amostras repetiveis: repita o mesmo modulo de forma uniforme, com a mesma escala fisica em toda a mesma superficie.",
    "A escala dos modulos so pode mudar pela perspectiva natural do plano da parede; nao aumente nem reduza desenhos em pontos isolados, nao misture tamanhos diferentes e nao distorca o padrao.",
    "Alinhe as juntas e a grade do revestimento com as quinas, planos e linhas de fuga da parede para manter proporcao arquitetonica realista.",
    "Nao substitua por referencia parecida, nao simplifique o desenho e nao invente outro produto.",
    "Preserve a estrutura da primeira imagem.",
  ].join(" ")
}

async function bytesFromMaterialUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    return bytesFromImageUrl(imageUrl, "textura do produto")
  }

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error(`Download da textura do produto falhou com HTTP ${response.status}.`)
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType: response.headers.get("content-type") || "image/jpeg",
  }
}

async function getMaterialTexture(job: CompositionJob) {
  const imageUrl = await getCatalogMaterialImage(job)

  if (!imageUrl) {
    return null
  }

  try {
    const image = await bytesFromMaterialUrl(imageUrl)
    const metadata = await sharp(image.bytes).metadata()

    if (!metadata.width || !metadata.height) {
      return null
    }

    const width = Math.min(512, metadata.width)
    const height = Math.max(64, Math.round(width * (metadata.height / metadata.width)))
    const raw = await sharp(image.bytes)
      .resize(width, height, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer()

    return { raw, width, height }
  } catch {
    return null
  }
}

function isWallSurface(surface: string | null) {
  return surface === "wall" || surface === "painted_wall"
}

function mixColor(left: RgbColor, right: RgbColor, amount: number): RgbColor {
  const ratio = clamp(amount, 0, 1)

  return {
    r: left.r * (1 - ratio) + right.r * ratio,
    g: left.g * (1 - ratio) + right.g * ratio,
    b: left.b * (1 - ratio) + right.b * ratio,
  }
}

function renderWallPaintPixel(
  color: RgbColor,
  broadLuminance: number,
  detailLuminance: number,
  averageLuminance: number,
  ambientColor: RgbColor,
  x: number,
  y: number,
) {
  const broadShade = clamp(broadLuminance / Math.max(averageLuminance, 1), 0.72, 1.28)
  const localShadow = clamp((detailLuminance - broadLuminance) / 180, -0.07, 0.07)
  const shade = clamp(broadShade + localShadow, 0.62, 1.34)
  const warmedPaint = mixColor(color, { r: 224, g: 218, b: 208 }, 0.025)
  const ambientPaint = mixColor(warmedPaint, ambientColor, 0.055)
  const litPaint = shade >= 1
    ? mixColor(ambientPaint, { r: 255, g: 248, b: 236 }, clamp((shade - 1) / 0.28, 0, 1) * 0.18)
    : mixColor(ambientPaint, { r: 30, g: 28, b: 26 }, clamp((1 - shade) / 0.38, 0, 1) * 0.38)
  const plasterTexture =
    (deterministicNoise(Math.floor(x / 9), Math.floor(y / 9)) - 0.5) * 0.7 +
    (deterministicNoise(Math.floor(x / 31), Math.floor(y / 29)) - 0.5) * 1.1 +
    (deterministicNoise(x * 5, y * 5) - 0.5) * 0.45

  return {
    r: clamp(litPaint.r + plasterTexture, 0, 255),
    g: clamp(litPaint.g + plasterTexture, 0, 255),
    b: clamp(litPaint.b + plasterTexture, 0, 255),
  }
}

function renderPaintPixel(
  color: RgbColor,
  sourceLuminance: number,
  detailLuminance: number,
  averageLuminance: number,
  x: number,
  y: number,
  surface: string | null,
  ambientColor: RgbColor,
) {
  const isWall = isWallSurface(surface)

  if (isWall) {
    return renderWallPaintPixel(color, sourceLuminance, detailLuminance, averageLuminance, ambientColor, x, y)
  }

  const localShade = isWall
    ? clamp(sourceLuminance / Math.max(averageLuminance, 1), 0.82, 1.18)
    : clamp(sourceLuminance / Math.max(averageLuminance, 1), 0.38, 1.84)
  const tileWidth = 172
  const tileHeight = 116
  const grout = surface === "floor" && (x % tileWidth < 2 || y % tileHeight < 2) ? -26 : 0
  const vein = surface === "floor"
    ? Math.max(0, Math.sin((x + y * 1.7) * 0.035 + deterministicNoise(Math.floor(x / 42), Math.floor(y / 42)) * 5) - 0.82) * -95
    : 0
  const noise = (deterministicNoise(x, y) - 0.5) * (surface === "floor" ? 14 : isWall ? 1.2 : 6)
  const fineNoise = (deterministicNoise(x * 3, y * 3) - 0.5) * (surface === "floor" ? 10 : isWall ? 0.6 : 5)
  const shade = isWall ? localShade : localShade * 0.96
  const materialVariation = noise + fineNoise + grout + vein

  return {
    r: clamp(color.r * shade + materialVariation, 0, 255),
    g: clamp(color.g * shade + materialVariation, 0, 255),
    b: clamp(color.b * shade + materialVariation, 0, 255),
  }
}

async function finishRenderedComposition(bytes: Buffer) {
  return sharp(bytes)
    .modulate({ brightness: 1.01, saturation: 1.025 })
    .linear(1.035, -3)
    .sharpen({ sigma: 0.55, m1: 0.32, m2: 0.18 })
    .png()
    .toBuffer()
}

function renderTexturePixel(texture: { raw: Buffer; width: number; height: number }, sourceLuminance: number, averageLuminance: number, x: number, y: number, surface: string | null) {
  const perspective = surface === "floor" ? clamp(0.55 + (y / Math.max(1, texture.height)) * 1.25, 0.65, 1.8) : 1
  const scale = surface === "floor" ? 0.42 / perspective : 0.68
  const textureX = Math.abs(Math.floor(x * scale)) % texture.width
  const textureY = Math.abs(Math.floor(y * scale)) % texture.height
  const textureOffset = (textureY * texture.width + textureX) * 3
  const tileWidth = surface === "floor" ? Math.max(90, Math.round(150 * perspective)) : 220
  const tileHeight = surface === "floor" ? Math.max(70, Math.round(118 * perspective)) : 160
  const grout = (x % tileWidth < 2 || y % tileHeight < 2) ? 0.82 : 1
  const localShade = clamp(sourceLuminance / Math.max(averageLuminance, 1), 0.5, 1.55)

  return {
    r: clamp(texture.raw[textureOffset] * localShade * grout, 0, 255),
    g: clamp(texture.raw[textureOffset + 1] * localShade * grout, 0, 255),
    b: clamp(texture.raw[textureOffset + 2] * localShade * grout, 0, 255),
  }
}

async function renderOriginalSurface(job: CompositionJob, baseImage: BaseImage, mask: SurfaceMask, foregroundMask?: SurfaceMask | null) {
  const color = await getRequestedPaintColor(job)
  const surface = getRequestedSurface(job)
  const isWall = isWallSurface(surface)
  const texture = surface === "floor" ? await getMaterialTexture(job) : null
  const fallbackColor = color || getFallbackSurfaceColor(job, surface)

  if (!fallbackColor && !texture) {
    throw new Error("Nao encontrei cor ou textura de produto valida para renderizar a superficie.")
  }

  validateSurfaceMask(mask, job)
  await validateRasterMask(mask, baseImage)

  const baseRaw = await sharp(baseImage.bytes)
    .resize(baseImage.width, baseImage.height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer()
  const originalRaw = Buffer.from(baseRaw)
  const shadeRaw = isWall
    ? await sharp(baseImage.bytes)
      .resize(baseImage.width, baseImage.height, { fit: "fill" })
      .blur(44)
      .ensureAlpha()
      .raw()
      .toBuffer()
    : baseRaw
  const detailShadeRaw = isWall
    ? await sharp(baseImage.bytes)
      .resize(baseImage.width, baseImage.height, { fit: "fill" })
      .blur(24)
      .ensureAlpha()
      .raw()
      .toBuffer()
    : shadeRaw
  const maskBuffer = await createMaskBuffer(mask, baseImage)
  const solidMaskRaw = await sharp(maskBuffer)
    .threshold(128)
    .greyscale()
    .raw()
    .toBuffer()
  const maskRaw = await sharp(maskBuffer)
    .blur(isWall ? 1.05 : 0.3)
    .greyscale()
    .raw()
    .toBuffer()
  const expandedMaskRaw = isWall
    ? await sharp(maskBuffer)
      .blur(4.2)
      .greyscale()
      .raw()
      .toBuffer()
    : maskRaw
  const foregroundRaw = foregroundMask?.maskDataUrl
    ? await sharp(await createMaskBuffer(foregroundMask, baseImage))
      .blur(1.25)
      .greyscale()
      .raw()
      .toBuffer()
    : null

  let selectedWeight = 0
  let selectedLuminance = 0

  for (let index = 0; index < solidMaskRaw.length; index += 1) {
    const weight = solidMaskRaw[index] / 255

    if (weight <= 0.08) {
      continue
    }

    const offset = index * 4
    const shadeOffset = index * 4
    selectedWeight += weight
    selectedLuminance += pixelLuminance(shadeRaw[shadeOffset], shadeRaw[shadeOffset + 1], shadeRaw[shadeOffset + 2]) * weight
  }

  if (selectedWeight <= 0) {
    throw new Error("A mascara nao possui pixels suficientes para recolorir a superficie.")
  }

  const averageLuminance = selectedLuminance / selectedWeight
  for (let index = 0; index < maskRaw.length; index += 1) {
    const maskAlpha = maskRaw[index] / 255
    const expandedAlpha = expandedMaskRaw[index] / 255

    if (maskAlpha <= 0.01 && expandedAlpha <= 0.01) {
      continue
    }

    const offset = index * 4
    const sourceRed = baseRaw[offset]
    const sourceGreen = baseRaw[offset + 1]
    const sourceBlue = baseRaw[offset + 2]
    const sourceOriginalLuminance = pixelLuminance(sourceRed, sourceGreen, sourceBlue)
    const sourceOriginalSaturation = pixelSaturation(sourceRed, sourceGreen, sourceBlue)
    const sourceLuminance = pixelLuminance(shadeRaw[offset], shadeRaw[offset + 1], shadeRaw[offset + 2])
    const detailLuminance = pixelLuminance(detailShadeRaw[offset], detailShadeRaw[offset + 1], detailShadeRaw[offset + 2])
    const x = index % baseImage.width
    const y = Math.floor(index / baseImage.width)
    const ambientColor = {
      r: shadeRaw[offset],
      g: shadeRaw[offset + 1],
      b: shadeRaw[offset + 2],
    }
    const material = texture
      ? renderTexturePixel(texture, sourceLuminance, averageLuminance, x, y, surface)
      : renderPaintPixel(fallbackColor, sourceLuminance, detailLuminance, averageLuminance, x, y, surface, ambientColor)
    const coreBlend = isWall ? smoothStep(0.08, 0.88, maskAlpha) : clamp(maskAlpha, 0, 1)
    const haloBlend = isWall
      ? Math.max(0, expandedAlpha - maskAlpha) *
        clamp((sourceOriginalLuminance - 44) / 146, 0, 1) *
        clamp((1 - sourceOriginalSaturation) * 1.35, 0, 1) *
        0.82
      : 0
    const foregroundCoreProtection = foregroundRaw
      ? smoothStep(0.78, 0.96, foregroundRaw[index] / 255) * 0.98
      : 0
    const edgeBlend = clamp(Math.max(coreBlend, haloBlend) * (1 - foregroundCoreProtection), 0, 1)

    baseRaw[offset] = Math.round(sourceRed * (1 - edgeBlend) + material.r * edgeBlend)
    baseRaw[offset + 1] = Math.round(sourceGreen * (1 - edgeBlend) + material.g * edgeBlend)
    baseRaw[offset + 2] = Math.round(sourceBlue * (1 - edgeBlend) + material.b * edgeBlend)
  }

  if (foregroundRaw) {
    for (let index = 0; index < foregroundRaw.length; index += 1) {
      const surfaceProtection = smoothStep(0.12, 0.74, maskRaw[index] / 255)
      const foregroundValue = foregroundRaw[index] / 255
      const foregroundCore = smoothStep(0.78, 0.96, foregroundValue)
      const foregroundEdge = smoothStep(0.04, 0.74, foregroundValue) * (1 - surfaceProtection)
      const foregroundAlpha = clamp(Math.max(foregroundCore, foregroundEdge), 0, 1)

      if (foregroundAlpha <= 0.01) {
        continue
      }

      const offset = index * 4
      baseRaw[offset] = Math.round(baseRaw[offset] * (1 - foregroundAlpha) + originalRaw[offset] * foregroundAlpha)
      baseRaw[offset + 1] = Math.round(baseRaw[offset + 1] * (1 - foregroundAlpha) + originalRaw[offset + 1] * foregroundAlpha)
      baseRaw[offset + 2] = Math.round(baseRaw[offset + 2] * (1 - foregroundAlpha) + originalRaw[offset + 2] * foregroundAlpha)
    }
  }

  const rendered = await sharp(baseRaw, {
    raw: {
      width: baseImage.width,
      height: baseImage.height,
      channels: 4,
    },
  }).png().toBuffer()

  return finishRenderedComposition(rendered)
}

async function compositeGeneratedSurface(job: CompositionJob, baseImage: BaseImage, mask: SurfaceMask, generatedImage: GeneratedImage) {
  validateSurfaceMask(mask, job)
  await validateRasterMask(mask, baseImage)
  const baseLayer = await sharp(baseImage.bytes)
    .resize(baseImage.width, baseImage.height, { fit: "fill" })
    .png()
    .toBuffer()
  const generatedRaw = await sharp(generatedImage.bytes)
    .resize(baseImage.width, baseImage.height, { fit: "cover", position: "centre" })
    .ensureAlpha()
    .raw()
    .toBuffer()
  const maskRaw = await sharp(await createMaskBuffer(mask, baseImage))
    .blur(0.8)
    .greyscale()
    .raw()
    .toBuffer()

  for (let index = 0; index < maskRaw.length; index += 1) {
    generatedRaw[index * 4 + 3] = maskRaw[index]
  }

  const generatedLayer = await sharp(generatedRaw, {
    raw: {
      width: baseImage.width,
      height: baseImage.height,
      channels: 4,
    },
  }).png().toBuffer()

  return sharp(baseLayer)
    .composite([{ input: generatedLayer, blend: "over" }])
    .png()
    .toBuffer()
}

function buildPrompt(job: CompositionJob, baseImage: BaseImage) {
  return [
    "Gere obrigatoriamente uma nova imagem editada. A resposta final precisa incluir uma imagem no payload; nao responda com explicacoes, perguntas ou texto sem imagem.",
    "Edite a imagem base recebida pelo cliente para criar uma composicao visual realista.",
    getFrameInstruction(baseImage),
    environmentStructureGuardrail,
    surfaceSegmentationGuardrail,
    getTargetSurfaceInstruction(job),
    "Preserve perspectiva, iluminacao, sombras, escala, textura e proporcoes do ambiente original.",
    "Nao adicione textos, marcas d'agua, logos ou elementos que nao foram pedidos.",
    job.catalogItemName ? `Produto ou referencia principal: ${job.catalogItemName}.` : "",
    job.catalogColorReference ? `Referencia tecnica de cor obrigatoria: ${job.catalogColorReference}. Use essa cor na parede/area solicitada.` : "",
    typeof job.changeStrength === "number" ? `Intensidade da mudanca: ${job.changeStrength} de 100. Quanto menor, mais conservadora e fiel a imagem original; quanto maior, mais perceptivel a alteracao solicitada.` : "",
    `Modo: ${job.mode}.`,
    `Briefing do cliente: ${job.prompt}`,
  ].filter(Boolean).join("\n")
}

function buildLocalizedRenderPrompt(job: CompositionJob, baseImage: BaseImage) {
  return [
    "Gere obrigatoriamente uma nova imagem editada. A resposta final precisa incluir uma imagem no payload; nao responda com explicacoes, perguntas ou texto sem imagem.",
    "Renderize uma versao da imagem base com a alteracao solicitada, mantendo alinhamento perfeito com a foto original.",
    getFrameInstruction(baseImage),
    environmentStructureGuardrail,
    surfaceSegmentationGuardrail,
    getTargetSurfaceInstruction(job),
    "A edicao final sera aplicada por mascara sobre a foto original. Mesmo assim, gere a superficie editada no mesmo lugar, escala, perspectiva, sombras e iluminacao da imagem base.",
    "Nao mude moveis, objetos, piso, teto, portas, janelas ou revestimentos. Esses elementos serao preservados da foto original.",
    "Apenas a superficie alvo pode parecer nova/renderizada.",
    job.catalogItemName ? `Produto ou referencia principal: ${job.catalogItemName}.` : "",
    job.catalogColorReference ? `Cor/material obrigatorio da superficie alvo: ${job.catalogColorReference}.` : "",
    typeof job.changeStrength === "number" ? `Intensidade da mudanca: ${job.changeStrength} de 100. Quanto menor, mais conservadora e fiel a imagem original; quanto maior, mais perceptivel a alteracao solicitada.` : "",
    `Modo: ${job.mode}.`,
    `Briefing do cliente: ${job.prompt}`,
  ].filter(Boolean).join("\n")
}

function getClosestAspectRatio(width: number, height: number) {
  const imageRatio = width / height
  const override = process.env.OPENROUTER_IMAGE_ASPECT_RATIO?.trim()

  if (override && override !== "auto" && supportedAspectRatios.some((item) => item.value === override)) {
    return override
  }

  return supportedAspectRatios.reduce((best, item) => {
    const currentDistance = Math.abs(item.ratio - imageRatio)
    const bestDistance = Math.abs(best.ratio - imageRatio)

    return currentDistance < bestDistance ? item : best
  }).value
}

function getOpenRouterImageConfig(baseImage: BaseImage) {
  return {
    aspect_ratio: getClosestAspectRatio(baseImage.width, baseImage.height),
    image_size: getOpenRouterImageSize(),
    quality: getOpenRouterImageQuality(),
    output_format: getOpenRouterImageOutputFormat(),
  }
}

function getOpenRouterError(status: number, payload: OpenRouterImageResponse | null) {
  const error = payload?.error

  if (typeof error === "string" && error.trim()) {
    return error.trim()
  }

  if (typeof error === "object" && error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim()
  }

  return `OpenRouter respondeu HTTP ${status}.`
}

function toAbsoluteImageUrl(value: string) {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith("data:")) {
    return value
  }

  return `${getPublicAppBaseUrl()}${value.startsWith("/") ? value : `/${value}`}`
}

async function buildBaseImage(bytes: Buffer, mimeType: string): Promise<BaseImage> {
  const metadata = await sharp(bytes).metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error("Nao foi possivel identificar as dimensoes da imagem base.")
  }

  return {
    dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
    bytes,
    mimeType,
    width: metadata.width,
    height: metadata.height,
  }
}

async function getBaseImage(job: CompositionJob): Promise<BaseImage> {
  const failedSources: string[] = []

  if (job.baseMessageId) {
    const message = await findInboxMessage(job.tenantSlug, job.conversationId, job.baseMessageId)

    if (!message) {
      failedSources.push("mensagem base nao encontrada")
    } else if (message.contentType !== "image") {
      failedSources.push("mensagem base nao e imagem")
    } else {
      try {
        const media = await resolveWhatsAppMedia(message)

        return buildBaseImage(media.bytes, media.mimeType)
      } catch (error) {
        failedSources.push(error instanceof Error ? error.message : "falha ao carregar midia da mensagem base")
      }
    }
  }

  if (job.baseImageUrl) {
    try {
      const image = await bytesFromImageUrl(toAbsoluteImageUrl(job.baseImageUrl), "imagem base")

      return buildBaseImage(image.bytes, image.mimeType)
    } catch (error) {
      failedSources.push(error instanceof Error ? error.message : "falha ao carregar URL da imagem base")
    }
  }

  const fallback = await getLatestInboundBaseImage(job)

  if (fallback) {
    return fallback
  }

  throw new Error(
    failedSources.length > 0
      ? `Nao foi possivel recuperar a imagem base da composicao: ${failedSources.join("; ")}. Envie ou selecione novamente uma imagem base valida para criar uma nova composicao.`
      : "Job nao possui imagem base vinculada."
  )
}

function isMissingGeneratedMediaError(error: unknown) {
  const code = (error as NodeJS.ErrnoException)?.code
  const message = error instanceof Error ? error.message : String(error)

  return code === "ENOENT" && message.includes("/generated/")
}

async function getLatestInboundBaseImage(job: CompositionJob): Promise<BaseImage | null> {
  const messages = await listInboxMessages(job.tenantSlug, job.conversationId)
  const createdAt = new Date(job.createdAt).getTime()
  const candidates = messages
    .filter((message) =>
      message.direction === "inbound" &&
      message.contentType === "image" &&
      (!Number.isFinite(createdAt) || new Date(message.createdAt).getTime() <= createdAt)
    )
    .reverse()

  for (const message of candidates) {
    try {
      const media = await resolveWhatsAppMedia(message)

      return buildBaseImage(media.bytes, media.mimeType)
    } catch (error) {
      if (!isMissingGeneratedMediaError(error)) {
        throw error
      }
    }
  }

  return null
}

function getImageUrlFromString(value: string): string | null {
  const dataUrlMatch = value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/)
  if (dataUrlMatch?.[0]) {
    return dataUrlMatch[0]
  }

  const markdownImageMatch = value.match(/!\[[^\]]*]\(([^)]+)\)/)
  if (markdownImageMatch?.[1]) {
    return markdownImageMatch[1]
  }

  const plainUrlMatch = value.match(/https?:\/\/[^\s)]+/)
  return plainUrlMatch?.[0] ?? null
}

function getImageUrlFromUnknown(value: unknown): string | null {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return getImageUrlFromString(value)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = getImageUrlFromUnknown(item)
      if (found) return found
    }

    return null
  }

  if (typeof value !== "object") {
    return null
  }

  const record = value as Record<string, unknown>
  const directUrl = typeof record.url === "string" ? record.url : null

  if (directUrl && (directUrl.startsWith("data:image/") || /^https?:\/\//i.test(directUrl))) {
    return directUrl
  }

  const knownNestedUrl =
    getImageUrlFromUnknown(record.image_url) ||
    getImageUrlFromUnknown(record.imageUrl) ||
    getImageUrlFromUnknown(record.source)

  if (knownNestedUrl) {
    return knownNestedUrl
  }

  for (const item of Object.values(record)) {
    const found = getImageUrlFromUnknown(item)
    if (found) return found
  }

  return null
}

function collectPayloadText(value: unknown, parts: string[] = []) {
  if (!value) {
    return parts
  }

  if (typeof value === "string") {
    if (!value.startsWith("data:image/") && !/^https?:\/\//i.test(value)) {
      parts.push(value)
    }
    return parts
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPayloadText(item, parts)
    }
    return parts
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.text === "string") {
      parts.push(record.text)
    }

    for (const [key, item] of Object.entries(record)) {
      if (["image_url", "imageUrl", "source", "url", "text"].includes(key)) {
        continue
      }
      collectPayloadText(item, parts)
    }
  }

  return parts
}

function getPayloadTextPreview(payload: OpenRouterImageResponse | null) {
  const message = payload?.choices?.[0]?.message
  const text = collectPayloadText(message?.content)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  return text ? text.slice(0, 280) : ""
}

function getImageUrlFromPayload(payload: OpenRouterImageResponse | null) {
  if (!payload) {
    return null
  }

  for (const choice of payload.choices ?? []) {
    const message = choice.message
    const imageUrl = getImageUrlFromUnknown(message?.images) || getImageUrlFromUnknown(message?.content)

    if (imageUrl) {
      return imageUrl
    }
  }

  return getImageUrlFromUnknown(payload)
}

function getPayloadNoImageDiagnostic(payload: OpenRouterImageResponse | null) {
  if (!payload) {
    return "payload=null"
  }

  const choices = payload.choices ?? []
  const choiceSummary = choices.slice(0, 3).map((choice, index) => {
    const message = choice.message
    const images = Array.isArray(message?.images) ? message.images.length : 0
    const contentType = Array.isArray(message?.content) ? `array:${message.content.length}` : typeof message?.content
    const keys = message ? Object.keys(message).join(",") : "sem-message"

    return [
      `choice${index}=finish:${String(choice.finish_reason ?? "-")}`,
      `native:${String(choice.native_finish_reason ?? "-")}`,
      `content:${contentType}`,
      `images:${images}`,
      `keys:${keys}`,
    ].join("/")
  }).join(" | ")

  const error = typeof payload.error === "string"
    ? payload.error
    : payload.error?.message

  return [
    `id=${payload.id ?? "-"}`,
    `model=${payload.model ?? "-"}`,
    `choices=${choices.length}`,
    choiceSummary,
    error ? `error=${error.slice(0, 220)}` : "",
  ].filter(Boolean).join("; ")
}

async function bytesFromImageUrl(imageUrl: string, context = "imagem") {
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)

    if (!match) {
      throw new Error(`Data URL invalida para ${context}.`)
    }

    return {
      bytes: Buffer.from(match[2], "base64"),
      mimeType: match[1],
    }
  }

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error(`Falha ao baixar ${context}: HTTP ${response.status}.`)
  }

  const mimeType = response.headers.get("content-type") || "image/png"

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType,
  }
}

async function normalizeResultToBaseDimensions(bytes: Buffer, mimeType: string, baseImage: BaseImage) {
  const metadata = await sharp(bytes).metadata()

  if (metadata.width === baseImage.width && metadata.height === baseImage.height) {
    return { bytes, mimeType }
  }

  const normalizedBytes = await sharp(bytes)
    .resize(baseImage.width, baseImage.height, { fit: "cover", position: "centre" })
    .png()
    .toBuffer()

  return {
    bytes: normalizedBytes,
    mimeType: "image/png",
  }
}

async function saveImageResult(job: CompositionJob, bytes: Buffer, mimeType: string, baseImage: BaseImage) {
  const normalized = await normalizeResultToBaseDimensions(bytes, mimeType, baseImage)
  const watermarkedBytes = await applyTenantWatermark(job, normalized.bytes)
  const fileName = getFileName(job, normalized.mimeType)
  const filePath = path.join(outputDir, fileName)

  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, watermarkedBytes)

  const resultPath = `/generated/compositions/${fileName}`
  const watermarkedMimeType = watermarkedBytes === normalized.bytes ? normalized.mimeType : "image/png"

  await saveGeneratedAsset(resultPath, watermarkedBytes, watermarkedMimeType)

  return resultPath
}

function getImageGenerationModels(primaryModel: string, fallbackModelIds: string[]) {
  const models = [primaryModel, ...fallbackModelIds]

  if (fallbackModelIds.length === 0 && primaryModel !== defaultImageFallbackModel) {
    models.push(defaultImageFallbackModel)
  }

  return [...new Set(models.filter(Boolean))]
}

function normalizeOpenRouterError(error: unknown) {
  return error instanceof Error ? error.message : "Falha desconhecida ao gerar imagem."
}

async function requestOpenRouterImage(
  provider: AiProvider,
  model: string,
  job: CompositionJob,
  baseImage: BaseImage,
  content: Array<Record<string, unknown>>,
  profile: Awaited<ReturnType<typeof getAiModelProfile>>
) {
  const response = await fetch(appendPath(provider.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: getOpenRouterHeaders(provider),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      modalities: ["image", "text"],
      image_config: getOpenRouterImageConfig(baseImage),
      stream: false,
      temperature: profile?.temperature,
      max_tokens: profile?.maxTokens,
      user: job.tenantSlug,
    }),
    signal: AbortSignal.timeout(180000),
  })
  const payload = await response.json().catch(() => null) as OpenRouterImageResponse | null

  if (!response.ok || payload?.error) {
    throw new Error(getOpenRouterError(response.status, payload))
  }

  const imageUrl = getImageUrlFromPayload(payload)

  if (!imageUrl) {
    const textPreview = getPayloadTextPreview(payload)
    const diagnostic = getPayloadNoImageDiagnostic(payload)
    throw new Error(
      textPreview
        ? `OpenRouter nao retornou imagem no payload para o modelo ${payload?.model || model}. Diagnostico: ${diagnostic}. Resposta do modelo: ${textPreview}`
        : `OpenRouter nao retornou imagem no payload para o modelo ${payload?.model || model}. Diagnostico: ${diagnostic}.`
    )
  }

  const image = await bytesFromImageUrl(imageUrl, "resultado OpenRouter")

  return {
    ...image,
    model: payload?.model || model,
  } satisfies GeneratedImage
}

async function generateImageWithOpenRouter(provider: AiProvider, job: CompositionJob, baseImage: BaseImage, prompt: string) {
  const profile = await getAiModelProfile("image_generation")
  const model = profile?.modelId || "google/gemini-3-pro-image-preview"
  const fallbackModelIds = profile?.fallbackModelIds ?? []
  const referenceImageUrls = await getCatalogMaterialImages(job)
  const content = [
    {
      type: "text",
      text: [
        prompt,
        getReferenceImageInstruction(referenceImageUrls.length),
      ].filter(Boolean).join("\n"),
    },
    { type: "image_url", image_url: { url: baseImage.dataUrl, detail: "high" } },
    ...referenceImageUrls.map((imageUrl) => ({ type: "image_url", image_url: { url: imageUrl, detail: "high" } })),
  ]
  const models = getImageGenerationModels(model, fallbackModelIds)
  const failures: string[] = []

  for (const candidateModel of models) {
    try {
      return await requestOpenRouterImage(provider, candidateModel, job, baseImage, content, profile)
    } catch (error) {
      failures.push(`${candidateModel}: ${normalizeOpenRouterError(error)}`)
    }
  }

  throw new Error(`OpenRouter falhou em todos os modelos de imagem. ${failures.join(" | ")}`)
}

export async function processCompositionWithOpenRouter(job: CompositionJob) {
  const provider = await getActiveOpenRouterProvider()

  if (!provider) {
    throw new Error("Nenhum provider OpenRouter ativo com creditos disponiveis foi encontrado.")
  }

  const baseImage = await getBaseImage(job)

  if (shouldUseLocalSurfaceRender() && await isLocalizedSurfaceColorRequest(job)) {
    const mask = await requestExternalSurfaceMask(job, baseImage)
    const maskModel = mask
      ? [mask.provider, mask.model].filter(Boolean).join("/")
      : null

    if (!mask || !maskModel) {
      throw new Error("Nao foi possivel obter uma mascara Grounded-SAM valida para a composicao localizada.")
    }

    const foregroundMask = await requestExternalForegroundMask(job, baseImage).catch(() => null)
    const compositedImage = await renderOriginalSurface(job, baseImage, mask, foregroundMask)
    const resultImageUrl = await saveImageResult(job, compositedImage, "image/png", baseImage)

    return {
      resultImageUrl,
      provider: "openrouter" as const,
      model: `${maskModel}${foregroundMask?.model ? `+foreground-restore:${foregroundMask.model}` : ""}+local-surface-render`,
    }
  }

  const image = await generateImageWithOpenRouter(provider, job, baseImage, buildPrompt(job, baseImage))
  const resultImageUrl = await saveImageResult(job, image.bytes, image.mimeType, baseImage)

  return {
    resultImageUrl,
    provider: "openrouter" as const,
    model: image.model,
  }
}
