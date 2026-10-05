"use client"

import { useState, ReactNode } from "react"
import { SpectrumProvider } from "@/components/spectrum/spectrum-provider"
import { AppSidebar } from "@/components/app-sidebar"

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SpectrumProvider>
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        variant="superadmin"
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
      />
      <main className="min-w-0 flex-1 overflow-hidden bg-transparent">{children}</main>
    </div>
    </SpectrumProvider>
  )
}
