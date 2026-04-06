import type { ReactNode } from "react"
import { SocketProvider } from "@/lib/realtime/socket-provider"
import { TenantSidebar } from "@/components/organisms/tenant-sidebar"

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <SocketProvider>
      <div className="flex h-screen bg-background">
        <TenantSidebar slug={slug} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SocketProvider>
  )
}
