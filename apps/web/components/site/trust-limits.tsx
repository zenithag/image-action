import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface TrustLimitsProps {
  title: string
  text: string
  tone?: SectionTone
}

/**
 * TrustLimits (Guia, cap. 5.2/5.4) — limites, profissionais e natureza
 * ilustrativa. Obrigatório em páginas com impacto material (cap. 5.2).
 */
export function TrustLimits({ title, text, tone = "white" }: TrustLimitsProps) {
  const t = TONE_CLASSES[tone]
  const isBlue = tone === "blue"

  return (
    <section className={cn(t.bg, "px-4 py-14 sm:px-6 lg:px-8")}>
      <div
        className={cn(
          "mx-auto max-w-5xl rounded-3xl border p-8 sm:p-10",
          isBlue ? "border-white/10 bg-white/5" : "border-brand-blue/10 bg-brand-blue/[0.03]"
        )}
      >
        <h2 className={cn("font-display text-xl font-semibold sm:text-2xl", t.heading)}>{title}</h2>
        <p className={cn("mt-3 text-sm leading-6 sm:text-base", t.body)}>{text}</p>
      </div>
    </section>
  )
}
