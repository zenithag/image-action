import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface Step {
  number: string
  title: string
  description: string
}

interface StepsFlowProps {
  eyebrow: string
  title: string
  steps: Step[]
  note?: string
  id?: string
  tone?: SectionTone
}

/** StepsFlow (Guia, cap. 5.2) — os quatro passos do fluxo, ordem fixa, exemplos mudam por página. */
export function StepsFlow({ eyebrow, title, steps, note, id, tone = "white" }: StepsFlowProps) {
  const t = TONE_CLASSES[tone]

  return (
    <section id={id} className={cn(t.bg, "py-16 lg:py-24")}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>
          <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
        </div>

        <ol className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.number} className={cn("rounded-2xl border p-6", t.card, t.cardBorder)}>
              <span className="text-sm font-bold text-brand-tiffany-dark">{step.number}</span>
              <h3 className={cn("font-display mt-2 text-base font-semibold", t.heading)}>{step.title}</h3>
              <p className={cn("mt-2 text-sm leading-6", t.body)}>{step.description}</p>
            </li>
          ))}
        </ol>

        {note && <p className={cn("mx-auto mt-8 max-w-2xl text-center text-sm", t.body)}>{note}</p>}
      </div>
    </section>
  )
}
