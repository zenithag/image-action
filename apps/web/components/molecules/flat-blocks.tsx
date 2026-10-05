import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Titled block that sits directly on the page background (no card). */
export function Section({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("py-10 text-center text-sm text-muted-foreground", className)}>{children}</p>
}

/** One indicator of a KPI strip: label, big value and a delta or hint line. */
export function Metric({ label, value, delta, hint }: { label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="min-w-0 px-5 first:pl-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-[28px] font-extrabold leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-1.5 h-4 text-xs text-muted-foreground">
        {delta != null ? (
          <>
            <b className={delta >= 0 ? "text-success-ink" : "text-danger"}>{delta >= 0 ? "+" : ""}{delta}%</b> vs. período anterior
          </>
        ) : (
          hint
        )}
      </p>
    </div>
  )
}

/** Row of indicators separated by thin rules. */
export function MetricStrip({ children, columns = 5 }: { children: ReactNode; columns?: 4 | 5 }) {
  return (
    <div className={cn("grid grid-cols-2 gap-y-5 border-y border-border py-5 md:divide-x md:divide-border", columns === 5 ? "md:grid-cols-5" : "md:grid-cols-4")}>
      {children}
    </div>
  )
}
