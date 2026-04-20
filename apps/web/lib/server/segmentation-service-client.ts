export type SegmentationTarget = "painted_wall" | "wall" | "floor" | "ceiling" | "foreground_objects" | "objects"

export type SegmentationResult = {
  ok: boolean
  provider: string
  model?: string | null
  target: SegmentationTarget
  mask?: string | null
  confidence?: number | null
  message?: string | null
}

export function getSegmentationServiceUrl() {
  return process.env.SEGMENTATION_SERVICE_URL?.trim().replace(/\/+$/, "") || ""
}

export async function requestSegmentationMask(input: {
  image: string
  target: SegmentationTarget
  prompt: string
  exclude?: string[]
  width?: number
  height?: number
}) {
  const baseUrl = getSegmentationServiceUrl()

  if (!baseUrl) {
    return null
  }

  const response = await fetch(`${baseUrl}/segment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120000),
  })
  const payload = await response.json().catch(() => null) as SegmentationResult | { detail?: string } | null

  if (!response.ok) {
    const detail = payload && "detail" in payload ? payload.detail : null
    const message = detail || `Servico de segmentacao respondeu HTTP ${response.status}.`

    if (
      response.status === 422
      && (
        message.includes("provider ativo")
        || message.includes("REPLICATE_API_TOKEN")
        || message.includes("sem provider ativo")
      )
    ) {
      return null
    }

    throw new Error(message)
  }

  if (!payload || !("ok" in payload) || !payload.ok || !payload.mask) {
    throw new Error(payload && "message" in payload && payload.message
      ? payload.message
      : "Servico de segmentacao nao retornou mascara valida.")
  }

  return payload
}
