"use client"

import { useEffect, useMemo, useRef, useState, ReactNode, use } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SocketProvider } from "@/lib/realtime/socket-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { getTenantBrandingVariables, normalizeTenantBrandingSnapshot, type TenantBrandingSnapshot } from "@/lib/tenant-branding"
import type { TenantSettings } from "@/lib/tenant-settings-types"
import { BarChart3, Grid2X2, Image as ImageIcon, MessageSquare, Paintbrush, Settings, Smartphone, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const mobileNavItems = [
  { href: "/tenant/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/tenant/compositions", label: "Compos.", icon: ImageIcon },
  { href: "/tenant/editor", label: "Estúdio", icon: Paintbrush },
  { href: "/tenant/catalog", label: "Catálogo", icon: Grid2X2 },
  { href: "/tenant/contacts", label: "Contatos", icon: Users },
  { href: "/tenant/whatsapp", label: "Whats", icon: Smartphone },
  { href: "/tenant/analytics", label: "Dados", icon: BarChart3 },
  { href: "/tenant/settings", label: "Ajustes", icon: Settings },
]

async function loadTenantBranding(tenantSlug: string) {
  const response = await fetch(`/api/tenant/${tenantSlug}/settings`, { cache: "no-store" })

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar a marca do tenant.")
  }

  const settings = await response.json() as TenantSettings
  return normalizeTenantBrandingSnapshot({
    companyName: settings.general.companyName,
    primaryColor: settings.branding.primaryColor,
    logoUrl: settings.branding.logoUrl,
  })
}

export default function TenantLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const activeMobileNavRef = useRef<HTMLAnchorElement | null>(null)
  const [branding, setBranding] = useState<TenantBrandingSnapshot>(() =>
    normalizeTenantBrandingSnapshot({
      companyName: slug,
      primaryColor: "#31C48D",
      logoUrl: "",
    })
  )

  useEffect(() => {
    let isMounted = true

    void loadTenantBranding(slug)
      .then((nextBranding) => {
        if (isMounted) {
          setBranding(nextBranding)
        }
      })
      .catch(() => undefined)

    const handleBrandingUpdate = (event: Event) => {
      const detail = (event as CustomEvent<Partial<TenantBrandingSnapshot> & { tenantSlug?: string }>).detail

      if (!detail || detail.tenantSlug !== slug) {
        return
      }

      setBranding((current) => normalizeTenantBrandingSnapshot({
        ...current,
        ...detail,
      }))
    }

    window.addEventListener("tenant-branding-updated", handleBrandingUpdate as EventListener)

    return () => {
      isMounted = false
      window.removeEventListener("tenant-branding-updated", handleBrandingUpdate as EventListener)
    }
  }, [slug])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)")
    const syncCollapsedState = () => setCollapsed(mediaQuery.matches)

    syncCollapsedState()
    mediaQuery.addEventListener("change", syncCollapsedState)

    return () => mediaQuery.removeEventListener("change", syncCollapsedState)
  }, [])

  useEffect(() => {
    activeMobileNavRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [pathname])

  const brandingVariables = useMemo(
    () => getTenantBrandingVariables(branding.primaryColor),
    [branding.primaryColor]
  )

  return (
    <SocketProvider>
      <div className="flex h-dvh overflow-hidden bg-background" style={brandingVariables}>
        <AppSidebar 
          variant="tenant" 
          tenantSlug={slug} 
          tenantDisplayName={branding.companyName}
          tenantLogoUrl={branding.logoUrl}
          tenantPrimaryColor={branding.primaryColor}
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
        />
        <main className="min-w-0 flex-1 overflow-hidden pb-[74px] md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-2 py-2 shadow-[0_-16px_40px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
          <div className="flex gap-1 overflow-x-auto pb-[env(safe-area-inset-bottom)] scrollbar-hide">
            {mobileNavItems.map((item) => {
              const href = item.href.replace("/tenant", `/tenant/${slug}`)
              const isActive = pathname === href || pathname?.startsWith(`${href}/`)
              return (
                <Link
                  key={item.href}
                  href={href}
                  ref={isActive ? activeMobileNavRef : undefined}
                  className={cn(
                    "flex min-w-[62px] flex-none flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[9px] font-semibold transition-colors",
                    isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </SocketProvider>
  )
}
