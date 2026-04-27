function normalizeBaseUrl(value?: string | null) {
  const text = value?.trim()
  return text ? text.replace(/\/+$/, "") : ""
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1"
  } catch {
    return value.includes("localhost") || value.includes("127.0.0.1")
  }
}

export function getPublicAppBaseUrl() {
  const candidates = [
    process.env.APP_PUBLIC_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
  ]

  const configuredUrl = candidates.map(normalizeBaseUrl).find(Boolean)
  if (configuredUrl) {
    return configuredUrl
  }

  return process.env.NODE_ENV === "production" ? "https://comofica.ai" : "http://localhost:3000"
}

export function getPublicWebhookUrl(channelInstanceId: string) {
  const baseUrl = getPublicAppBaseUrl()

  if (isLocalUrl(baseUrl)) {
    return null
  }

  const url = new URL("/api/webhooks/uazapi", baseUrl)
  url.searchParams.set("channelInstanceId", channelInstanceId)

  return url.toString()
}
