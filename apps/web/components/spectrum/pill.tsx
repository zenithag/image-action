import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Tone = "neutral" | "brand" | "ai" | "human" | "success" | "warning" | "danger"

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--cf-surface-sunken)] text-[var(--cf-ink-muted)]",
  brand: "bg-[var(--cf-brand-soft)] text-[var(--cf-brand-ink)]",
  ai: "bg-[var(--cf-brand-soft)] text-[var(--cf-brand-ink)]",
  human: "bg-[color-mix(in_srgb,var(--cf-human)_14%,transparent)] text-[var(--cf-human)]",
  success: "bg-[var(--cf-brand-soft)] text-[var(--cf-brand-ink)]",
  warning: "bg-[#fff1d1] text-[#903300] dark:bg-[#33230f] dark:text-[#f8c48a]",
  danger: "bg-[#fee5e5] text-[#9c2626] dark:bg-[#3a1712] dark:text-[#ffb3a8]",
}

/** Small status/label chip. Server-renderable; always carries text, never colour alone. */
export function Pill({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  )
}
