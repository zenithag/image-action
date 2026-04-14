"use client"

import { useState, ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        variant="superadmin"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
