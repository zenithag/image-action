import { ConversationList } from "@/components/organisms/conversation-list"
import { ChatPanel } from "@/components/organisms/chat-panel"

export default function InboxPage() {
  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0">
        <ConversationList />
      </div>
      <ChatPanel />
    </div>
  )
}
