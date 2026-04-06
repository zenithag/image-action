const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type FetchOptions = RequestInit & {
  accessToken?: string
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { accessToken, headers: customHeaders, ...rest } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(
      Object.entries(customHeaders || {}).filter(([, v]) => v != null) as [string, string][]
    ),
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...rest,
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}
