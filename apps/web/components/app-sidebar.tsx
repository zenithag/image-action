"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useSession, signOut } from "next-auth/react"
import {
  House,
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
  PackagePlus,
  Gift,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
} from "@/components/spectrum/icons"

import { cn } from "@/lib/utils"
import { SideNav } from "@/components/molecules/side-nav"

interface NavItem {
  href: string
  label: string
  icon: typeof MessageSquare
  hot?: boolean
}

const tenantNavItems: NavItem[] = [
  { href: "/tenant", label: "Visão geral", icon: House },
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
  { href: "/superadmin", label: "Clientes", icon: Building2 },
  { href: "/superadmin/users", label: "Usuários", icon: Users },
  { href: "/superadmin/usage", label: "Uso & Custos", icon: BarChart3 },
  { href: "/superadmin/logs", label: "Logs de composições", icon: Bot },
  { href: "/superadmin/channels", label: "Canais", icon: Zap },
  { href: "/superadmin/ai", label: "IA & Modelos", icon: Bot },
  { href: "/superadmin/billing", label: "Pagamentos", icon: CreditCard },
  { href: "/superadmin/plans", label: "Planos", icon: PackagePlus },
  { href: "/superadmin/benefits", label: "Benefícios", icon: Gift },
]

interface AppSidebarProps {
  variant?: "tenant" | "superadmin"
  collapsed: boolean
  onToggle: () => void
  tenantSlug?: string
  tenantDisplayName?: string
  tenantLogoUrl?: string
  catalogEnabled?: boolean
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
  catalogEnabled = false,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0)
  // Use the matching platform logo variant for the active theme.
  const onDarkSurface = mounted && (resolvedTheme ?? theme) === "dark"
  const platformSymbol = onDarkSurface ? "/simbolo-branco.svg" : "/simbolo-azul.svg"
  const platformLogo = onDarkSurface ? "/logo-horizontal-branco.svg" : "/logo-horizontal-azul.svg"
  const navItems = variant === "superadmin" ? superadminNavItems : tenantNavItems.filter(item => item.href !== "/tenant/catalog" || catalogEnabled)
  const tenantName = variant === "superadmin" ? "Administração" : tenantDisplayName && tenantDisplayName !== tenantSlug
    ? tenantDisplayName
    : (tenantSlug || "Empresa").replace(/[-_]+/g, " ")
  const tenantInitial = tenantName[0]?.toUpperCase() || "T"
  const userName = session?.user?.name || "Usuário"
  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")

  const activeNavHref = navItems
    .map((item) => (tenantSlug ? item.href.replace("/tenant", `/tenant/${tenantSlug}`) : item.href))
    .filter((href, index) => pathname === href || (navItems[index].href !== "/tenant" && pathname?.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0]

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
        collapsed ? "w-[64px]" : "w-[196px]",
        variant === "tenant" && "max-md:hidden",
        "shrink-0 bg-[var(--cf-chrome-bg,var(--background))]",
      )}
    >
      {/* Keep the platform logo and workspace name consistent across cliente and admin navigation. */}
      <div
        className={cn(
          "flex shrink-0 flex-col gap-2",
          "px-4 pb-3 pt-4",
          collapsed && "items-center px-0",
        )}
      >
        <div className={cn("flex w-full items-center gap-1", collapsed && "justify-center")}>
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center transition-opacity hover:opacity-80"
            style={collapsed ? { justifyContent: "center" } : undefined}
            title={collapsed ? `${tenantName} · expandir menu` : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <img src={platformSymbol} alt="Como fica.ai" className="h-8 w-auto" />
            ) : (
              <img src={platformLogo} alt="Como fica.ai" className="h-7 w-auto max-w-full" />
            )}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggle}
              className="ml-auto flex h-7 w-5 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-all hover:text-sidebar-foreground"
              title="Recolher"
              aria-label="Recolher menu"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2">
            {variant === "tenant" && tenantLogoUrl ? (
              <img src={tenantLogoUrl} alt="" className="h-5 w-5 shrink-0 rounded object-contain" />
            ) : null}
            <span className="min-w-0 truncate text-sm font-medium leading-snug text-sidebar-foreground">{tenantName}</span>
          </div>
        )}
      </div>

      {/* Nav items */}
      {collapsed ? (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const actualHref = tenantSlug ? item.href.replace("/tenant", `/tenant/${tenantSlug}`) : item.href
            const isActive = pathname === actualHref || (item.href !== "/tenant" && pathname?.startsWith(actualHref + "/"))
            const badge = item.label === "Inbox" ? inboxUnreadCount : 0
  
            return (
              <Link
                key={item.href}
                href={actualHref}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-3 transition-colors",
                  collapsed ? "justify-center" : "",
                  "text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-[var(--cf-accent,var(--primary))] text-[var(--cf-on-accent,var(--primary-foreground))]"
                      : "group-hover:bg-[var(--spectrum-gray-300,var(--muted))]"
                  )}
                >
                <item.icon
                  className={cn("h-5 w-5 shrink-0", collapsed ? "" : "ml-0.5")}
                  strokeWidth={1.5}
                />
                </span>
                {!collapsed && (
                  <span className="truncate text-sm font-medium">{item.label}</span>
                )}
                {item.hot && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      collapsed ? "absolute right-2 top-2" : "ml-auto mr-1",
                      isActive ? "bg-[var(--cf-on-accent,#fff)]" : "bg-primary"
                    )}
                  />
                )}
                {badge > 0 && !collapsed && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-md bg-primary px-1 text-xs font-bold tabular-nums text-primary-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
                {badge > 0 && collapsed && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-md bg-primary px-0.5 text-xs font-bold tabular-nums text-primary-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      ) : (
        <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-2" aria-label={variant === "superadmin" ? "Administração" : "Painel da empresa"}>
          <SideNav
            label={variant === "superadmin" ? "Administração" : "Painel da empresa"}
            activeHref={activeNavHref}
            items={navItems.map((item) => ({
              href: tenantSlug ? item.href.replace("/tenant", `/tenant/${tenantSlug}`) : item.href,
              label: item.label,
              icon: <item.icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />,
              badge: item.label === "Inbox" ? inboxUnreadCount : 0,
              hot: item.hot,
            }))}
          />
        </nav>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-3 py-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Sair"
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-destructive",
            collapsed ? "justify-center" : "",
          )}
        >
          <LogOut className="h-[17px] w-[17px] shrink-0" strokeWidth={1.5} />
          {!collapsed && <span className="text-sm font-medium">Sair</span>}
        </button>

      </div>
    </aside>
  )
}
