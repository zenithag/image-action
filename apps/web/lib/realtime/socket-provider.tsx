"use client"

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { io, type Socket } from "socket.io-client"
import { useSession } from "next-auth/react"
import { useConversationStore } from "@/lib/stores/conversation-store"
import type { Conversation } from "@studio/contracts"

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000"

export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const socketRef = useRef<Socket | null>(null)
  const addMessage = useConversationStore((s) => s.addMessage)
  const updateConversation = useConversationStore((s) => s.updateConversation)

  useEffect(() => {
    const auth: Record<string, string> = {}
    if (session?.accessToken) {
      auth.token = session.accessToken
    }
    if (session?.user?.tenantId) {
      auth.tenant_id = session.user.tenantId
    }

    const socket = io(WS_URL, {
      path: "/socket.io",
      auth,
      transports: ["websocket", "polling"],
    })

    socket.on("new_message", (data: { conversation_id: string; message: Record<string, unknown> }) => {
      addMessage(data.conversation_id, {
        id: crypto.randomUUID(),
        tenant_id: "",
        conversation_id: data.conversation_id,
        direction: (data.message.direction as "inbound" | "outbound") || "inbound",
        role: (data.message.role as "customer" | "assistant" | "operator") || "customer",
        content: (data.message.content as string) || "",
        content_type: (data.message.content_type as "text") || "text",
        provider_message_id: null,
      })
    })

    socket.on("conversation_updated", (data: { conversation_id: string; state: string; handled_by: string; operator_id?: string }) => {
      updateConversation(data.conversation_id, {
        state: data.state as Conversation["state"],
        handled_by: data.handled_by as Conversation["handled_by"],
        operator_id: data.operator_id || null,
      })
    })

    socket.on("job_updated", (data: { job_id: string; status: string; conversation_id: string }) => {
      if (data.status === "done" || data.status === "failed") {
        updateConversation(data.conversation_id, {
          state: "completed",
        })
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [session?.accessToken, session?.user?.tenantId, addMessage, updateConversation])

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  )
}
