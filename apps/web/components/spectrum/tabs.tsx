"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import { useSpectrum } from "./use-spectrum"

export type TabItem = { value: string; label: string; count?: number }

type TabsProps = {
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  "aria-label": string
  className?: string
}

/** Spectrum `sp-tabs` (quiet, compact). Counts render as a pill that stays readable when selected. */
export function Tabs({ items, value, onValueChange, className, ...aria }: TabsProps) {
  const ref = useRef<HTMLElement & { selected?: string }>(null)
  const ready = useSpectrum("tab", "tabs")
  const latest = useRef(onValueChange)
  latest.current = onValueChange

  // sp-tabs matches `selected` against its sp-tab children when it updates, so the value has to be
  // applied once both elements are defined and the children are in place.
  useEffect(() => {
    if (!ready) return

    let cancelled = false

    void Promise.all([customElements.whenDefined("sp-tabs"), customElements.whenDefined("sp-tab")]).then(async () => {
      const element = ref.current as (HTMLElement & { selected?: string; updateComplete?: Promise<unknown> }) | null
      if (cancelled || !element) return

      if (element.selected === value) element.selected = ""
      await element.updateComplete
      if (!cancelled) element.selected = value
    })

    return () => {
      cancelled = true
    }
  }, [value, ready, items.length])

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const listener = (event: Event) => {
      const next = (event.target as HTMLElement & { selected?: string }).selected
      if (typeof next === "string") latest.current(next)
    }
    element.addEventListener("change", listener)

    return () => element.removeEventListener("change", listener)
  }, [])

  return (
    <sp-tabs ref={ref} className={cn(className)} {...({ selected: value, quiet: true, size: "m" } as object)} {...aria}>
      {items.map((item) => (
        <sp-tab key={item.value} {...({ value: item.value, label: item.label } as object)}>
          {item.label}
          {item.count != null ? <span className="cf-count">{item.count}</span> : null}
        </sp-tab>
      ))}
    </sp-tabs>
  )
}
