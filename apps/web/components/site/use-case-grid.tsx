import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface UseCaseItem {
  title: string
  description: string
  href?: string
  linkLabel?: string
  badge?: string
}

interface UseCaseGridProps {
  eyebrow: string
  title: string
  items: UseCaseItem[]
  id?: string
  tone?: SectionTone
}

/** UseCaseGrid (Guia, cap. 5.2) — casos de uso/páginas por mercado, dados por vertical. */
export function UseCaseGrid({ eyebrow, title, items, id, tone = "white" }: UseCaseGridProps) {
  const t = TONE_CLASSES[tone]
  const linkColor =
    tone === "blue" ? "text-brand-tiffany" : "text-brand-tiffany-dark"

  return (
    <section id={id} className={cn(t.bg, "py-16 lg:py-24")}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>
          <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const content = (
              <>
                <div className="flex items-center gap-2">
                  <h3 className={cn("font-display text-base font-semibold", t.heading)}>{item.title}</h3>
                  {item.badge && (
                    <span className="rounded-full bg-brand-tiffany/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-tiffany-dark">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className={cn("mt-2 text-sm leading-6", t.body)}>{item.description}</p>
                {item.href && item.linkLabel && (
                  <span className={cn("mt-4 inline-flex items-center gap-1 text-sm font-semibold", linkColor)}>
                    {item.linkLabel}
                    <ArrowUpRight className="size-4" />
                  </span>
                )}
              </>
            )

            if (item.href) {
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className={cn(
                    "rounded-2xl border p-6 transition-shadow hover:shadow-[0_18px_40px_-16px_rgba(0,22,90,0.25)]",
                    t.card,
                    t.cardBorder
                  )}
                >
                  {content}
                </Link>
              )
            }

            return (
              <div key={item.title} className={cn("rounded-2xl border p-6", t.card, t.cardBorder)}>
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
