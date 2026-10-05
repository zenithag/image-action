"use client"

import type { ReactNode } from "react"

import { UserMenu } from "@/components/molecules/user-menu"
import { SearchField } from "@/components/spectrum"
import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  subtitle?: string
  /**
   * Search scoped to the current page: it filters what this page shows (catalog items, contacts,
   * compositions...). Rendered centred in the header so it sits in the same place on every screen.
   */
  search?: {
    value: string
    onChange: (value: string) => void
    label: string
    placeholder: string
  }
  actions?: ReactNode
  className?: string
}

/** Page bar: title on the left, contextual search in the middle, page actions on the right. */
export function PageHeader({ title, subtitle, search, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "grid min-h-12 shrink-0 grid-cols-[minmax(0,1fr)_minmax(240px,520px)_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b border-border bg-[var(--cf-chrome-bg,var(--background))] px-8 py-2 max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:[&>[data-slot=search]]:order-last max-lg:[&>[data-slot=search]]:col-span-2",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-base font-bold leading-tight text-foreground">{title}</h1>
        {subtitle ? <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div data-slot="search" className="flex min-w-0 justify-center">
        {search ? (
          <SearchField
            label={search.label}
            placeholder={search.placeholder}
            value={search.value}
            onValueChange={search.onChange}
            width="100%"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}<UserMenu /></div>
    </header>
  )
}
