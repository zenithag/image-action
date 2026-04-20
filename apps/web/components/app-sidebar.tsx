"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import {
  MessageSquare,
  LayoutGrid,
  Image as ImageIcon,
  Users,
  Settings,
  BarChart3,
  Building2,
  Globe,
  Zap,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Smartphone,
  Bot,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: typeof MessageSquare
  badge?: number
}

const tenantNavItems: NavItem[] = [
  { href: "/tenant/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/tenant/catalog", label: "Catálogo", icon: LayoutGrid },
  { href: "/tenant/compositions", label: "Composições", icon: ImageIcon },
  { href: "/tenant/contacts", label: "Contatos", icon: Users },
  { href: "/tenant/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/tenant/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/tenant/settings", label: "Configurações", icon: Settings },
]

const superadminNavItems: NavItem[] = [
  { href: "/superadmin", label: "Tenants", icon: Building2 },
  { href: "/superadmin/usage", label: "Uso & Custos", icon: BarChart3 },
  { href: "/superadmin/channels", label: "Canais", icon: Zap },
  { href: "/superadmin/ai", label: "IA & Modelos", icon: Bot },
]

interface AppSidebarProps {
  variant?: "tenant" | "superadmin"
  collapsed: boolean
  onToggle: () => void
  tenantSlug?: string
}

export function AppSidebar({ variant = "tenant", collapsed, onToggle, tenantSlug }: AppSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0)
  const navItems = variant === "superadmin" ? superadminNavItems : tenantNavItems
  const userName = session?.user?.name || "Usuário"
  const userRole = session?.user?.roles?.includes("superadmin") ? "Superadmin" : "Tenant"
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
        // O badge nao deve quebrar a navegacao se o inbox estiver indisponivel.
      }
    }

    void loadUnreadCount()
    const intervalId = window.setInterval(loadUnreadCount, 3000)
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
        "relative z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
        collapsed ? "w-[60px]" : "w-64"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        className="absolute -right-3 top-[52px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-3.5 overflow-hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span
          className={cn(
            "text-lg font-semibold text-foreground whitespace-nowrap transition-all duration-300 font-display",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          ComoFica
        </span>
      </div>

      {/* Tenant info */}
      {variant === "tenant" && (
        <div className="border-b border-border p-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <Building2 className="h-4 w-4" />
            </div>
            <div
              className={cn(
                "flex-1 truncate transition-all duration-300",
                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
              )}
            >
              <p className="text-sm font-medium text-foreground">{tenantSlug || "Tenant"}</p>
              <p className="text-xs text-muted-foreground">{tenantSlug ? `${tenantSlug}.comofica.ai` : "Sem tenant vinculado"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2 overflow-hidden">
        {navItems.map((item) => {
          const actualHref = tenantSlug ? item.href.replace("/tenant", `/tenant/${tenantSlug}`) : item.href
          const isActive = pathname === actualHref || pathname?.startsWith(actualHref + "/")
          const badge = item.label === "Inbox" ? inboxUnreadCount : item.badge ?? 0
          return (
            <Link
              key={item.href}
              href={actualHref}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  "flex-1 whitespace-nowrap transition-all duration-300",
                  collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
                )}
              >
                {item.label}
              </span>
              {badge > 0 && !collapsed && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                  {badge}
                </span>
              )}
              {badge > 0 && collapsed && (
                <span className="absolute left-7 top-1 flex h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-1 overflow-hidden">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={mounted ? (theme === "dark" ? "Modo claro" : "Modo escuro") : "Alternar tema"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-primary"
          )}
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )
          ) : (
            <Sun className="h-5 w-5 shrink-0 opacity-0" />
          )}
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
            )}
          >
            {mounted ? (theme === "dark" ? "Modo Claro" : "Modo Escuro") : "Tema"}
          </span>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {initials || "VF"}
          </div>
          <div
            className={cn(
              "flex-1 truncate transition-all duration-300",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-primary"
        >
          <Zap className="h-5 w-5 shrink-0" />
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
            )}
          >
            Sair
          </span>
        </button>
      </div>
    </aside>
  )
}
