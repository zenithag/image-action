import sharp from "sharp"

export type NormalizedImage = {
  bytes: Buffer
  mimeType: "image/webp"
  fileExtension: "webp"
}

const defaultMaxDimension = 2000
const defaultQuality = 88

export function isNormalizableRasterImage(mimeType: string) {
  const normalized = mimeType.toLowerCase()

  return normalized.startsWith("image/") && !normalized.includes("svg")
}

export async function normalizeImageForUpload(
  bytes: Buffer,
  mimeType: string,
  options?: { maxDimension?: number; quality?: number }
): Promise<NormalizedImage> {
  if (!isNormalizableRasterImage(mimeType)) {
    throw new Error(`Tipo de imagem invalido para normalizacao: ${mimeType}.`)
  }

  const maxDimension = options?.maxDimension ?? defaultMaxDimension
  const quality = options?.quality ?? defaultQuality
  const normalizedBytes = await sharp(bytes)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer()

  return {
    bytes: normalizedBytes,
    mimeType: "image/webp",
    fileExtension: "webp",
  }
}

export function getNormalizedFileName(fileName: string) {
  const baseName = fileName.replace(/\.[a-zA-Z0-9]+$/, "") || "imagem"

  return `${baseName}.webp`
}

export async function normalizeDataImageUrlForUpload(value: string) {
  const match = value.match(/^data:([^;,]+);base64,(.+)$/i)

  if (!match || !isNormalizableRasterImage(match[1])) {
    return value
  }

  const normalized = await normalizeImageForUpload(Buffer.from(match[2], "base64"), match[1])

  return `data:${normalized.mimeType};base64,${normalized.bytes.toString("base64")}`
}
