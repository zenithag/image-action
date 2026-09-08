import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TONE_CLASSES, type SectionTone } from "@/components/site/tone"

interface ContextualCtaProps {
  title: string
  text: string
  ctaLabel: string
  ctaHref: string
  microcopy?: string
  id?: string
  tone?: SectionTone
}

/** ContextualCTA (Guia, cap. 5.2) — conversão final por página, mensagem e tracking próprios. */
export function ContextualCta({ title, text, ctaLabel, ctaHref, microcopy, id, tone = "blue" }: ContextualCtaProps) {
  const t = TONE_CLASSES[tone]
  const isBlue = tone === "blue"

  return (
    <section id={id} className={t.bg}>
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
        <h2 className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", t.heading)}>{title}</h2>
        <p className={cn("mx-auto mt-4 max-w-xl", t.body)}>{text}</p>
        <Button
          asChild
          size="lg"
          className={cn(
            "mt-8",
            isBlue
              ? "bg-brand-tiffany text-brand-blue hover:bg-brand-tiffany-dark hover:text-white"
              : "bg-brand-blue text-white hover:bg-brand-blue-light"
          )}
        >
          <a href={ctaHref} target="_blank" rel="noreferrer">
            {ctaLabel}
          </a>
        </Button>
        {microcopy && <p className={cn("mt-4 text-sm", isBlue ? "text-white/50" : "text-muted-foreground")}>{microcopy}</p>}
      </div>
    </section>
  )
}
