"use client"

import { use, useState } from "react"
import { ConversationList } from "@/components/conversation-list"
import { ChatPanel } from "@/components/chat-panel"

export default function InboxPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  return (
    <div className="flex h-full min-h-0 min-w-0 overflow-hidden bg-background">
      <aside className="h-full min-h-0 w-80 max-w-[44vw] shrink-0 overflow-hidden border-r border-border bg-card xl:w-[360px]">
        <ConversationList
          tenantSlug={slug}
          selectedId={selectedConversation}
          onSelect={setSelectedConversation}
        />
      </aside>
      <section className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <ChatPanel tenantSlug={slug} conversationId={selectedConversation} />
      </section>
    </div>
  )
}
