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
  Zap,
  Sun,
  Moon,
  Smartphone,
  Bot,
  Paintbrush,
  Globe,
  GitBranch,
  ChevronDown,
  LogOut,
  CreditCard,
} from "lucide-react"

import { SafeImage } from "@/components/safe-image"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: typeof MessageSquare
  badge?: number
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
        "relative z-40 hidden h-dvh flex-col border-r border-border bg-secondary/50 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] md:flex",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* Brand — 68px height, horizontal logo (or symbol when collapsed) */}
      <div
        className={cn(
          "flex h-[68px] shrink-0 cursor-pointer items-center overflow-hidden px-[18px] py-5",
          collapsed && "justify-center px-0"
        )}
        onClick={onToggle}
      >
        {collapsed ? (
          <img src="/simbolo-azul.png" alt="Como Fica" className="h-8 w-8 shrink-0 rounded-[7px] object-contain" />
        ) : (
          <img
            src="/logo-horizontal-azul.svg"
            alt="Como Fica"
            className="h-8 w-auto max-w-full shrink-0 object-contain"
          />
        )}
      </div>

      {/* Tenant card */}
      {variant === "tenant" && (
        <div
          title={collapsed ? tenantName : undefined}
          className={cn(
            "flex cursor-pointer items-center border border-border bg-card transition-all duration-300",
            collapsed
              ? "mx-auto h-11 w-11 justify-center rounded-2xl p-1.5 shadow-sm"
              : "mx-3 gap-2.5 rounded-[10px] p-2.5"
          )}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-lg"
            style={{
              background: tenantLogoUrl ? "transparent" : "var(--sidebar-accent)",
              color: "var(--sidebar-primary)",
              border: tenantLogoUrl ? "1px solid var(--border)" : undefined,
            }}
          >
            {tenantLogoUrl ? (
              <SafeImage
                src={tenantLogoUrl}
                alt={tenantName}
                className="h-full w-full rounded-lg object-contain"
                fallbackClassName="min-h-0 gap-0 p-0 text-[0]"
                fallbackLabel={tenantInitial}
                fallbackHint=""
              />
            ) : (
              tenantInitial
            )}
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 transition-all duration-300",
              collapsed ? "hidden" : "w-auto opacity-100"
            )}
          >
            <p className="truncate text-[13px] font-medium text-foreground">{tenantName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{tenantSlug ? `${tenantSlug}.comofica.ai` : "Sem tenant vinculado"}</p>
          </div>
          {!collapsed && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
      )}

      {/* Section label */}
      <div
        className={cn(
          "px-[18px] pb-1.5 pt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
          collapsed && "opacity-0"
        )}
      >
        {variant === "superadmin" ? "Plataforma" : "Operação"}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-2.5 py-1">
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
                "relative flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
              )}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span
                className={cn(
                  "flex-1 whitespace-nowrap transition-all duration-300",
                  collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
                )}
              >
                {item.label}
              </span>
              {item.hot && !collapsed && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary">
                  NOVO
                </span>
              )}
              {badge > 0 && !collapsed && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">
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
      <div className="border-t border-border p-2.5 space-y-0.5 overflow-hidden">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={mounted ? (theme === "dark" ? "Modo claro" : "Modo escuro") : "Alternar tema"}
          className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-primary"
        >
          {mounted ? (
            theme === "dark" ? (
              <Sun className="h-[18px] w-[18px] shrink-0" />
            ) : (
              <Moon className="h-[18px] w-[18px] shrink-0" />
            )
          ) : (
            <Sun className="h-[18px] w-[18px] shrink-0 opacity-0" />
          )}
          <span
            className={cn(
              "whitespace-nowrap transition-all duration-300",
              collapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100"
            )}
          >
            {mounted ? (theme === "dark" ? "Modo claro" : "Modo escuro") : "Tema"}
          </span>
        </button>

        {/* User — gradient avatar */}
        <div className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
            style={{
              background: tenantPrimaryColor
                ? `linear-gradient(135deg, ${tenantPrimaryColor}, color-mix(in srgb, ${tenantPrimaryColor} 60%, #0ea5e9))`
                : "linear-gradient(135deg, var(--sidebar-primary), oklch(0.6 0.12 190))",
            }}
          >
            {initials || "VF"}
          </div>
          <div
            className={cn(
              "min-w-0 flex-1 truncate transition-all duration-300",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <p className="text-[13px] font-medium text-foreground">{userName}</p>
            <p className="text-[11px] text-muted-foreground">{variant === "superadmin" ? "Superadmin" : userRole}</p>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-primary/5 hover:text-primary"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
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
