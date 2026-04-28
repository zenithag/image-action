import { NextResponse } from "next/server"

import { subscribeInboxRealtime, type InboxRealtimeEvent } from "@/lib/server/inbox-realtime"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ slug: string }>
}

function formatSseEvent(eventName: string, data: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeatId: ReturnType<typeof setInterval> | null = null
  let isClosed = false

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (content: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(content))
          } catch {
            isClosed = true
          }
        }
      }

      const close = () => {
        if (isClosed) return
        isClosed = true
        unsubscribe?.()
        unsubscribe = null

        if (heartbeatId) {
          clearInterval(heartbeatId)
          heartbeatId = null
        }

        controller.close()
      }

      const sendEvent = (event: InboxRealtimeEvent) => {
        enqueue(formatSseEvent(event.type, event))
      }

      unsubscribe = subscribeInboxRealtime(slug, sendEvent)
      enqueue(formatSseEvent("ready", { tenantSlug: slug }))

      heartbeatId = setInterval(() => {
        enqueue(": heartbeat\n\n")
      }, 25000)

      request.signal.addEventListener("abort", close)
    },
    cancel() {
      isClosed = true
      unsubscribe?.()
      unsubscribe = null

      if (heartbeatId) {
        clearInterval(heartbeatId)
        heartbeatId = null
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
