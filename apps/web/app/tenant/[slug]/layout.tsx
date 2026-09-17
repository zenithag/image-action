"use client"

import { useEffect, useMemo, useRef, useState, ReactNode, use } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SocketProvider } from "@/lib/realtime/socket-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { getTenantBrandingVariables, normalizeTenantBrandingSnapshot, type TenantBrandingSnapshot } from "@/lib/tenant-branding"
import type { TenantSettings } from "@/lib/tenant-settings-types"
import { BarChart3, GitBranch, Grid2X2, Image as ImageIcon, MessageSquare, Paintbrush, Settings, Smartphone, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const mobileNavItems = [
  { href: "/tenant/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/tenant/compositions", label: "Compos.", icon: ImageIcon },
  { href: "/tenant/editor", label: "Estúdio", icon: Paintbrush },
  { href: "/tenant/flows", label: "Fluxos", icon: GitBranch },
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
        <main className="min-w-0 flex-1 overflow-hidden bg-transparent pb-[72px] md:pb-0">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background md:hidden">
          <div className="flex overflow-x-auto pb-[env(safe-area-inset-bottom)] scrollbar-hide">
            {mobileNavItems.map((item) => {
              const href = item.href.replace("/tenant", `/tenant/${slug}`)
              const isActive = pathname === href || pathname?.startsWith(`${href}/`)
              return (
                <Link
                  key={item.href}
                  href={href}
                  ref={isActive ? activeMobileNavRef : undefined}
                  className={cn(
                    "relative flex min-w-[56px] flex-none flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[9px] font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-primary" />
                  )}
                  <item.icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2 : 1.5} />
                  <span className="truncate max-w-full">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </SocketProvider>
  )
}
