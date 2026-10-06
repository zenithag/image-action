"use client"

import { use, useState } from "react"
import { ChatPanel } from "@/components/chat-panel"
import { ConversationList } from "@/components/conversation-list"
import styles from "@/components/inbox-layout.module.css"

export default function InboxPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const hasSelectedConversation = Boolean(selectedConversation)

  return (
    <div className={`${styles.inbox} flex h-full min-h-0 flex-col bg-background`}>
        <div className={`${styles.workspace} relative min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(290px,360px)_minmax(0,1fr)]`}>
          <aside className={hasSelectedConversation ? "hidden h-full min-h-0 overflow-hidden border-r border-border bg-card lg:flex lg:flex-col" : "flex flex-col h-full min-h-0 overflow-hidden border-r border-border bg-card lg:flex lg:flex-col"}>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ConversationList
                tenantSlug={slug}
                selectedId={selectedConversation}
                onSelect={setSelectedConversation}
              />
            </div>
          </aside>
          <section className={hasSelectedConversation ? "h-full min-h-0 overflow-hidden" : "hidden h-full min-h-0 overflow-hidden lg:block"}>
            <ChatPanel
              tenantSlug={slug}
              conversationId={selectedConversation}
              onBackToList={() => setSelectedConversation(null)}
              onConversationDeleted={() => setSelectedConversation(null)}
            />
          </section>
        </div>
    </div>
  )
}
