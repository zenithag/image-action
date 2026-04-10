"use client"

import { useState, ReactNode, use } from "react"
import { SocketProvider } from "@/lib/realtime/socket-provider"
import { AppSidebar } from "@/components/app-sidebar"

export default function TenantLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SocketProvider>
      <div className="flex h-screen bg-background">
        <AppSidebar 
          variant="tenant" 
          tenantSlug={slug} 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </SocketProvider>
  )
}
