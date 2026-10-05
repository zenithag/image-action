"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, LayoutGrid, ShoppingBag, LogOut } from "@/components/spectrum/icons"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "", icon: LayoutGrid, label: "Dashboard" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/catalog", icon: ShoppingBag, label: "Catalogo" },
]

export function TenantSidebar({ slug }: { slug: string }) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card/50">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="font-display text-lg font-semibold tracking-tight">{slug}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const fullHref = `/tenant/${slug}${item.href}`
          const isActive = pathname === fullHref
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
