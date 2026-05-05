"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { WhatsAppConnection } from "@/components/whatsapp-connection"

export default function WhatsAppPage() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-auto">
        <WhatsAppConnection />
      </main>
    </div>
  )
}
