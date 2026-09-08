import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

export interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  eyebrow?: string
  title: string
  items: FaqItem[]
  id?: string
  tone?: SectionTone
}

/**
 * FAQAccordion (Guia, cap. 5.2): "HTML semântico details/summary ou
 * equivalente acessível" — usa <details>/<summary> nativo, sem dependência
 * extra, com foco visível e navegação por teclado de graça.
 */
export function FaqAccordion({ eyebrow, title, items, id, tone = "white" }: FaqAccordionProps) {
  const t = TONE_CLASSES[tone]

  return (
    <section id={id} className={cn(t.bg, "px-4 py-16 sm:px-6 lg:px-8 lg:py-24")}>
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow && <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>}
        <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
      </div>

      <div className={cn("mx-auto mt-10 max-w-3xl divide-y rounded-2xl border", t.card, t.cardBorder, tone === "blue" ? "divide-white/10" : "divide-border")}>
        {items.map((item) => (
          <details key={item.question} className={cn("group px-6 py-5", tone === "blue" ? "open:bg-white/5" : "open:bg-brand-blue/[0.02]")}>
            <summary
              className={cn(
                "flex cursor-pointer list-none items-center justify-between gap-4 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
                t.heading
              )}
            >
              {item.question}
              <Plus className="size-4 shrink-0 text-brand-tiffany-dark transition-transform group-open:rotate-45" />
            </summary>
            <p className={cn("mt-3 text-sm leading-6", t.body)}>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
