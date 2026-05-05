"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ConversationList } from "@/components/conversation-list"
import { ChatPanel } from "@/components/chat-panel"

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState<string>("1")

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar variant="tenant" />
      <div className="flex flex-1">
        <div className="w-80 shrink-0">
          <ConversationList
            selectedId={selectedConversation}
            onSelect={setSelectedConversation}
          />
        </div>
        <div className="flex-1">
          <ChatPanel conversationId={selectedConversation} />
        </div>
      </div>
    </div>
  )
}
