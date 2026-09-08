import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface FeatureDetailProps {
  eyebrow?: string
  title: string
  text: string
  /** Linha de destaque em negrito, logo após o texto principal. */
  highlight?: string
  bullets?: string[]
  /** Faixa de rótulos curtos abaixo do texto (Guia: "Faixa: X | Y | Z"). */
  tags?: string[]
  /** Nota pequena/ressalva ao final (limites, "CONFIRMAR", etc.). */
  note?: string
  id?: string
  tone?: SectionTone
  /** Alinha o bloco à esquerda em vez de centralizado — útil pra blocos com texto longo. */
  align?: "center" | "left"
}

/**
 * Bloco de aprofundamento reutilizável — cobre o padrão que se repete no
 * Guia (cap. 7.3, 7.5, 7.6, 7.7, 7.9): título, texto, opcionalmente uma
 * lista de recursos/diferenciais e uma nota de limite/ressalva.
 */
export function FeatureDetail({
  eyebrow,
  title,
  text,
  highlight,
  bullets,
  tags,
  note,
  id,
  tone = "white",
  align = "center",
}: FeatureDetailProps) {
  const t = TONE_CLASSES[tone]
  const isLeft = align === "left"

  return (
    <section id={id} className={cn(t.bg, "px-4 py-16 sm:px-6 lg:px-8 lg:py-24")}>
      <div className={cn("mx-auto max-w-3xl", isLeft ? "text-left" : "text-center")}>
        {eyebrow && <p className={cn("text-sm font-semibold uppercase tracking-[0.16em]", t.eyebrow)}>{eyebrow}</p>}
        <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
        <p className={cn("mt-5 text-lg leading-7", t.body)}>{text}</p>
        {highlight && <p className={cn("mt-4 font-medium", t.heading)}>{highlight}</p>}

        {tags && tags.length > 0 && (
          <ul className={cn("mt-6 flex flex-wrap gap-2", isLeft ? "justify-start" : "justify-center")}>
            {tags.map((tag) => (
              <li
                key={tag}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  tone === "blue" ? "border-white/20 text-white/80" : "border-brand-blue/15 text-brand-blue/80"
                )}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      {bullets && bullets.length > 0 && (
        <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
          {bullets.map((bullet) => (
            <li key={bullet} className={cn("flex items-start gap-3 rounded-xl border p-4", t.card, t.cardBorder)}>
              <Check className="mt-0.5 size-4 shrink-0 text-brand-tiffany-dark" />
              <span className={cn("text-sm leading-6", tone === "blue" ? "text-white" : "text-foreground")}>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p className={cn("mx-auto mt-6 max-w-3xl text-sm italic", t.body, isLeft ? "text-left" : "text-center")}>
          {note}
        </p>
      )}
    </section>
  )
}
