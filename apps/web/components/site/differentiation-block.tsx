import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface DifferentiationBlockProps {
  eyebrow: string
  title: string
  bullets: string[]
  link?: { label: string; href: string }
  tone?: SectionTone
}

/** DifferentiationBlock (Guia, cap. 5.2) — por que não é "só IA genérica"; foco em operação e governança. */
export function DifferentiationBlock({ eyebrow, title, bullets, link, tone = "white" }: DifferentiationBlockProps) {
  const t = TONE_CLASSES[tone]
  const linkColor = tone === "blue" ? "text-brand-tiffany hover:text-white" : "text-brand-tiffany-dark hover:text-brand-blue"

  return (
    <section className={cn(t.bg, "px-4 py-16 sm:px-6 lg:px-8 lg:py-24")}>
      <div className="mx-auto max-w-2xl text-center">
        <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>
        <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
      </div>

      <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
        {bullets.map((bullet) => (
          <li key={bullet} className={cn("flex items-start gap-3 rounded-xl border p-4", t.card, t.cardBorder)}>
            <Check className="mt-0.5 size-4 shrink-0 text-brand-tiffany-dark" />
            <span className={cn("text-sm leading-6", tone === "blue" ? "text-white" : "text-foreground")}>{bullet}</span>
          </li>
        ))}
      </ul>

      {link && (
        <p className="mt-8 text-center">
          <a href={link.href} className={cn("text-sm font-semibold", linkColor)}>
            {link.label} →
          </a>
        </p>
      )}
    </section>
  )
}
