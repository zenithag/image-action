import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface HeroCta {
  label: string
  href: string
  external?: boolean
}

interface HeroByAudienceProps {
  eyebrow: string
  title: string
  subheadline: string
  primaryCta: HeroCta
  secondaryCta?: HeroCta
  microcopy?: string
  /** Faixa de diferenciais curtos abaixo do CTA (Guia, cap. 6.2). */
  proofItems?: string[]
  /** Slot visual — normalmente um <BeforeAfterDemo />. Sem visual, o texto ocupa a largura toda (útil pra páginas utilitárias como FAQ/Contato). */
  visual?: ReactNode
  /** "blue" = tratamento escuro imersivo; "white" = hero claro, mais leve. */
  tone?: "blue" | "white"
  /** Só tem efeito quando não há `visual` — centraliza o texto em vez de alinhar à esquerda. */
  align?: "left" | "center"
  /** Selo acima do eyebrow (Guia, cap. 12.3: "Hero - PUBLICAR COM SELO") — sinaliza status como "Aplicação futura". */
  badge?: string
}

/**
 * HeroByAudience (Guia de Estratégia, cap. 5.2): recebe H1/subheadline/CTAs
 * por página. Suporta dois tons pra permitir alternância de ritmo entre
 * páginas (cap. 15.2) sem duplicar o componente.
 */
export function HeroByAudience({
  eyebrow,
  title,
  subheadline,
  primaryCta,
  secondaryCta,
  microcopy,
  proofItems,
  visual,
  tone = "blue",
  align = "left",
  badge,
}: HeroByAudienceProps) {
  const isBlue = tone === "blue"
  const isCentered = !visual && align === "center"

  return (
    <section className={cn("relative overflow-hidden", isBlue ? "bg-brand-blue text-white" : "bg-white text-brand-blue")}>
      <div
        className={cn(
          "pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full blur-3xl",
          isBlue ? "bg-brand-tiffany/25" : "bg-brand-tiffany/15"
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute -left-32 bottom-0 size-[420px] rounded-full blur-3xl",
          isBlue ? "bg-brand-tiffany/10" : "bg-brand-blue/[0.05]"
        )}
        aria-hidden="true"
      />

      <div
        className={cn(
          "relative mx-auto gap-12 px-4 pb-16 pt-14 sm:px-6 lg:pb-24 lg:pt-20 lg:px-8",
          visual ? "grid max-w-7xl lg:grid-cols-2 lg:items-center" : "max-w-7xl",
          isCentered && "flex flex-col items-center text-center"
        )}
      >
        <div className={!visual ? (isCentered ? "w-full max-w-3xl mx-auto" : "max-w-2xl") : undefined}>
          {badge && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                isBlue ? "border-white/20 bg-white/10 text-white" : "border-brand-blue/15 bg-brand-blue/5 text-brand-blue"
              )}
            >
              {badge}
            </span>
          )}
          <p className={cn("font-semibold uppercase tracking-[0.16em] text-sm", badge ? "mt-4" : undefined, isBlue ? "text-brand-tiffany" : "text-brand-tiffany-dark")}>
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
            {title}
          </h1>
          <p className={cn("mt-5 max-w-xl text-lg leading-7", isCentered && "mx-auto", isBlue ? "text-white/80" : "text-muted-foreground")}>
            {subheadline}
          </p>

          <div className={cn("mt-8 flex flex-wrap items-center gap-3", isCentered && "justify-center")}>
            <Button
              asChild
              size="lg"
              className={
                isBlue
                  ? "bg-brand-tiffany text-brand-blue hover:bg-brand-tiffany-dark hover:text-white"
                  : "bg-brand-blue text-white hover:bg-brand-blue-light"
              }
            >
              <a href={primaryCta.href} target={primaryCta.external ? "_blank" : undefined} rel={primaryCta.external ? "noreferrer" : undefined}>
                {primaryCta.label}
              </a>
            </Button>
            {secondaryCta && (
              <Button
                asChild
                size="lg"
                variant="ghost"
                className={isBlue ? "text-white hover:bg-white/10 hover:text-white" : "text-brand-blue hover:bg-brand-blue/5 hover:text-brand-blue"}
              >
                <a href={secondaryCta.href}>{secondaryCta.label}</a>
              </Button>
            )}
          </div>

          {microcopy && <p className={cn("mt-4 text-sm", isBlue ? "text-white/60" : "text-muted-foreground")}>{microcopy}</p>}

          {proofItems && proofItems.length > 0 && (
            <ul
              className={cn(
                "mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm",
                isBlue ? "border-white/10 text-white/70" : "border-black/5 text-muted-foreground"
              )}
            >
              {proofItems.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-brand-tiffany" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {visual && <div>{visual}</div>}
      </div>
    </section>
  )
}
