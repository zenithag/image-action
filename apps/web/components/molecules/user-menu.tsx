"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { DropdownMenu } from "radix-ui"

import { LogOut, Settings, User } from "@/components/spectrum/icons"
import { getThemeContainer } from "@/components/spectrum/theme-container"

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground outline-none data-[highlighted]:bg-muted"

export function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U"
}

export const PROFILE_UPDATED_EVENT = "cf-profile-updated"

/** The stored profile photo; refreshed whenever the profile page saves a new one. */
function useProfileAvatar() {
  const [avatar, setAvatar] = useState("")

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetch("/api/me/profile", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { avatarUrl?: string } | null) => { if (!cancelled && data) setAvatar(data.avatarUrl || "") })
        .catch(() => undefined)
    }

    load()
    window.addEventListener(PROFILE_UPDATED_EVENT, load)

    return () => {
      cancelled = true
      window.removeEventListener(PROFILE_UPDATED_EVENT, load)
    }
  }, [])

  return avatar
}

/** Avatar in the top-right of every page header, with a dropdown for Configurações / Perfil / Sair. */
export function UserMenu() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const name = session?.user?.name || "Usuário"
  const email = session?.user?.email || ""
  const image = useProfileAvatar()
  const tenantSlug = /^\/tenant\/([^/]+)/.exec(pathname)?.[1]
  const base = tenantSlug ? `/tenant/${tenantSlug}` : "/superadmin"
  const settingsHref = tenantSlug ? `${base}/settings` : null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Menu do usuário: ${name}`}
          title={name}
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold"
          style={{ width: 32, height: 32, minHeight: 0, padding: 0, border: 0, borderRadius: "50%", background: "var(--cf-accent, var(--primary))", color: "var(--cf-on-accent, var(--primary-foreground))" }}
        >
          {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={getThemeContainer()}>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[90] min-w-52 rounded-lg border border-border bg-[var(--cf-chrome-bg,var(--card))] p-1.5 text-foreground shadow-lg"
        >
          <div className="px-2.5 py-1.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {settingsHref ? (
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href={settingsHref}><Settings size={16} aria-hidden="true" />Configurações</Link>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href={`${base}/perfil`}><User size={16} aria-hidden="true" />Perfil</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={itemClass} onSelect={() => void signOut({ callbackUrl: "/" })}>
            <LogOut size={16} aria-hidden="true" />Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
