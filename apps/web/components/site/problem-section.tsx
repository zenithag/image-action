import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface ProblemCard {
  title: string
  description: string
}

interface ProblemSectionProps {
  eyebrow: string
  title: string
  text: string
  /** Cards com título próprio (quando a dor se desdobra em situações distintas). */
  cards?: ProblemCard[]
  /** Lista simples de destaques curtos, sem título por item. */
  bullets?: string[]
  tone?: SectionTone
  id?: string
}

/** ProblemSection (Guia, cap. 5.2) — dor + mudança de perspectiva, copy específica por ICP. */
export function ProblemSection({ eyebrow, title, text, cards, bullets, tone = "white", id }: ProblemSectionProps) {
  const t = TONE_CLASSES[tone]

  return (
    <section id={id} className={cn(t.bg, "px-4 py-16 sm:px-6 lg:px-8 lg:py-24")}>
      <div className="mx-auto max-w-3xl text-center">
        <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>
        <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
        <p className={cn("mt-5 text-lg leading-7", t.body)}>{text}</p>
      </div>

      {cards && cards.length > 0 && (
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div key={card.title} className={cn("rounded-2xl border p-6", t.card, t.cardBorder)}>
              <h3 className={cn("font-display text-base font-semibold", t.heading)}>{card.title}</h3>
              <p className={cn("mt-2 text-sm leading-6", t.body)}>{card.description}</p>
            </div>
          ))}
        </div>
      )}

      {bullets && bullets.length > 0 && (
        <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
          {bullets.map((bullet) => (
            <li key={bullet} className={cn("flex items-start gap-2.5 text-sm leading-6", t.body)}>
              <Check className="mt-0.5 size-4 shrink-0 text-brand-tiffany-dark" />
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
