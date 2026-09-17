"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import {
  MessageSquare,
  Image as ImageIcon,
  Paintbrush,
  GitBranch,
  LayoutGrid,
  Users,
  Smartphone,
  BarChart3,
  Settings,
  Building2,
  Zap,
  Bot,
  CreditCard,
  Globe,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: typeof MessageSquare
  hot?: boolean
}

const tenantNavItems: NavItem[] = [
  { href: "/tenant/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/tenant/compositions", label: "Composições", icon: ImageIcon },
  { href: "/tenant/editor", label: "Estúdio", icon: Paintbrush, hot: true },
  { href: "/tenant/flows", label: "Fluxos", icon: GitBranch },
  { href: "/tenant/catalog", label: "Catálogo", icon: LayoutGrid },
  { href: "/tenant/contacts", label: "Contatos", icon: Users },
  { href: "/tenant/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/tenant/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/tenant/settings", label: "Configurações", icon: Settings },
]

const superadminNavItems: NavItem[] = [
  { href: "/superadmin", label: "Tenants", icon: Building2 },
  { href: "/superadmin/users", label: "Usuários", icon: Users },
  { href: "/superadmin/usage", label: "Uso & Custos", icon: BarChart3 },
  { href: "/superadmin/domains", label: "Domínios", icon: Globe },
  { href: "/superadmin/channels", label: "Canais", icon: Zap },
  { href: "/superadmin/ai", label: "IA & Modelos", icon: Bot },
  { href: "/superadmin/billing", label: "Pagamentos", icon: CreditCard },
]

interface AppSidebarProps {
  variant?: "tenant" | "superadmin"
  collapsed: boolean
  onToggle: () => void
  tenantSlug?: string
  tenantDisplayName?: string
  tenantLogoUrl?: string
  tenantPrimaryColor?: string
}

export function AppSidebar({
  variant = "tenant",
  collapsed,
  onToggle,
  tenantSlug,
  tenantDisplayName,
  tenantLogoUrl,
  tenantPrimaryColor,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0)
  const navItems = variant === "superadmin" ? superadminNavItems : tenantNavItems
  const tenantName = tenantDisplayName || tenantSlug || "Tenant"
  const tenantInitial = tenantName[0]?.toUpperCase() || "T"
  const userName = session?.user?.name || "Usuário"
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (variant !== "tenant" || !tenantSlug) {
      setInboxUnreadCount(0)
      return
    }

    let isMounted = true

    async function loadUnreadCount() {
      try {
        const response = await fetch(`/api/tenant/${tenantSlug}/inbox/unread`, { cache: "no-store" })
        if (!response.ok) return

        const payload = await response.json() as { unreadCount?: unknown }
        const unreadCount = typeof payload.unreadCount === "number" ? payload.unreadCount : 0

        if (isMounted) {
          setInboxUnreadCount(unreadCount)
        }
      } catch {
        // silence
      }
    }

    void loadUnreadCount()
    const intervalId = window.setInterval(loadUnreadCount, 10000)
    window.addEventListener("inbox:unread-changed", loadUnreadCount)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
      window.removeEventListener("inbox:unread-changed", loadUnreadCount)
    }
  }, [tenantSlug, variant])

  return (
    <aside
      className={cn(
        "relative z-40 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-[52px]" : "w-[180px]",
      )}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-sidebar-border px-5">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 transition-colors hover:opacity-80"
          title={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold"
            style={{
              background: tenantPrimaryColor || "var(--sidebar-primary)",
              color: "var(--sidebar-primary-foreground)",
            }}
          >
            {tenantInitial}
          </div>
          {!collapsed && (
            <span className="truncate text-[12px] font-medium text-sidebar-foreground">
              {tenantName}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "ml-auto shrink-0 flex h-5 w-5 items-center justify-center rounded text-sidebar-foreground/40 transition-all hover:text-sidebar-foreground",
          )}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const actualHref = tenantSlug ? item.href.replace("/tenant", `/tenant/${tenantSlug}`) : item.href
          const isActive = pathname === actualHref || pathname?.startsWith(actualHref + "/")
          const badge = item.label === "Inbox" ? inboxUnreadCount : 0

          return (
            <Link
              key={item.href}
              href={actualHref}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded px-2.5 py-2 transition-colors",
                collapsed ? "justify-center" : "",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-primary" />
              )}
              <item.icon
                className={cn("h-[17px] w-[17px] shrink-0", collapsed ? "" : "ml-0.5")}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              {!collapsed && (
                <span className="truncate text-[12px] font-medium">{item.label}</span>
              )}
              {item.hot && !isActive && (
                <span className="ml-auto mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              )}
              {badge > 0 && !collapsed && (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded bg-primary px-1 text-[9px] font-bold tabular-nums text-primary-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
              {badge > 0 && collapsed && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded bg-primary px-0.5 text-[8px] font-bold tabular-nums text-primary-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-3 py-2">
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={mounted ? (theme === "dark" ? "Modo claro" : "Modo escuro") : "Alternar tema"}
          className={cn(
            "flex items-center gap-2.5 rounded px-2 py-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "justify-center" : "",
          )}
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
            ) : (
              <Moon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
            )
          ) : (
            <div className="h-[17px] w-[17px] shrink-0" />
          )}
          {!collapsed && <span className="text-[12px] font-medium">Tema</span>}
        </button>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sair"
          className={cn(
            "flex items-center gap-2.5 rounded px-2 py-2 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-destructive",
            collapsed ? "justify-center" : "",
          )}
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" strokeWidth={1.8} />
          {!collapsed && <span className="text-[12px] font-medium">Sair</span>}
        </button>

        <div
          title={userName}
          className={cn(
            "mt-1 flex items-center gap-2 rounded px-2 py-1.5",
            collapsed ? "justify-center" : "",
          )}
        >
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            style={{
              background: tenantPrimaryColor
                ? `linear-gradient(135deg, ${tenantPrimaryColor}, color-mix(in srgb, ${tenantPrimaryColor} 60%, #0ea5e9))`
                : "var(--sidebar-primary)",
              color: "var(--sidebar-primary-foreground)",
            }}
          >
            {initials || "VF"}
          </div>
          {!collapsed && (
            <span className="truncate text-[11px] text-sidebar-foreground">{userName}</span>
          )}
        </div>
      </div>
    </aside>
  )
}
