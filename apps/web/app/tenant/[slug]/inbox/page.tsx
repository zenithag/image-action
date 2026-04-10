"use client"

import { useState } from "react"
import { ConversationList } from "@/components/conversation-list"
import { ChatPanel } from "@/components/chat-panel"

export default function InboxPage() {
  const [selectedConversation, setSelectedConversation] = useState<string>("1")

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-80 shrink-0 border-r border-border h-full">
        <ConversationList
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
        />
      </div>
      <div className="flex-1 h-full">
        <ChatPanel conversationId={selectedConversation} />
      </div>
    </div>
  )
}
