"use client"

import { cloneElement, useEffect, useRef, type MouseEvent, type ReactElement } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useSpectrum } from "@/components/spectrum/use-spectrum"

export type SideNavItem = {
  href: string
  label: string
  /** A single SVG icon element; it is slotted straight into the item so Spectrum can style it. */
  icon: ReactElement<{ slot?: string }>
  /** Unread/pending counter shown after the label. */
  badge?: number
  /** Small dot signalling a highlighted entry (shown only while it is not the active one). */
  hot?: boolean
}

type SideNavProps = {
  items: SideNavItem[]
  activeHref?: string
  label: string
}

/**
 * Spectrum `sp-sidenav` driven by Next routing. Items keep a real `href` (middle-click, copy
 * link) but plain left-clicks go through the client router instead of a full page load.
 */
export function SideNav({ items, activeHref, label }: SideNavProps) {
  const router = useRouter()
  const navRef = useRef<HTMLElement & { value?: string }>(null)
  const ready = useSpectrum("sidenav", "sidenavItem")

  // React can only set attributes on elements that are not upgraded yet, and the sidenav reads
  // its selection from properties, so push the active route in once both elements are defined.
  useEffect(() => {
    if (!ready) return

    let cancelled = false

    void Promise.all([customElements.whenDefined("sp-sidenav"), customElements.whenDefined("sp-sidenav-item")]).then(() => {
      const nav = navRef.current
      if (cancelled || !nav) return

      nav.value = activeHref ?? ""
      nav.querySelectorAll<HTMLElement & { value?: string; selected?: boolean }>("sp-sidenav-item").forEach((item) => {
        item.selected = item.value === activeHref
      })
    })

    return () => {
      cancelled = true
    }
  }, [activeHref, ready])

  function navigate(event: MouseEvent<HTMLElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    event.preventDefault()
    router.push(href)
  }

  // Plain links until the Spectrum elements exist: same destinations, works without JS/SSR.
  if (!ready) {
    return (
      <ul aria-label={label} className="m-0 flex list-none flex-col gap-0.5 p-0">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.href === activeHref ? "page" : undefined}
              className={`flex h-8 items-center gap-3 rounded-lg px-3 text-sm text-[var(--cf-ink)] no-underline ${item.href === activeHref ? "bg-[var(--cf-surface-hover)] font-semibold" : ""}`}
            >
              {cloneElement(item.icon, { slot: undefined })}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <sp-sidenav ref={navRef} aria-label={label}>
      {items.map((item) => (
        <sp-sidenav-item
          key={item.href}
          value={item.href}
          href={item.href}
          onClick={(event) => navigate(event, item.href)}
        >
          {cloneElement(item.icon, { slot: "icon" })}
          <span className="cf-nav-label">{item.label}</span>
          {item.badge && item.badge > 0 ? (
            <span
              aria-label={`${item.badge} não lidas`}
              style={{
                marginInlineStart: 8,
                verticalAlign: "middle",
                minWidth: 20,
                height: 20,
                padding: "0 6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                background: "var(--cf-brand)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          ) : null}
          {item.hot ? <span aria-hidden="true" className="cf-nav-dot" /> : null}
        </sp-sidenav-item>
      ))}
    </sp-sidenav>
  )
}
