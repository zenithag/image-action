/**
 * Sistema de alternância de fundo entre seções (Guia, cap. 15.2: "alternar
 * blocos claros e escuros para criar ritmo sem repetir seções"). Cada
 * componente de seção reutilizável recebe um `tone` e resolve suas próprias
 * cores de texto a partir dele — a página escolhe o ritmo, o componente só
 * garante contraste correto.
 */
export type SectionTone = "white" | "mist" | "blue"

interface ToneClasses {
  bg: string
  eyebrow: string
  heading: string
  body: string
  card: string
  cardBorder: string
}

export const TONE_CLASSES: Record<SectionTone, ToneClasses> = {
  white: {
    bg: "bg-white",
    eyebrow: "text-brand-tiffany-dark",
    heading: "text-brand-blue",
    body: "text-muted-foreground",
    card: "bg-card",
    cardBorder: "border-border",
  },
  mist: {
    bg: "bg-brand-mist",
    eyebrow: "text-brand-tiffany-dark",
    heading: "text-brand-blue",
    body: "text-muted-foreground",
    card: "bg-white",
    cardBorder: "border-black/5",
  },
  blue: {
    bg: "bg-brand-blue",
    eyebrow: "text-brand-tiffany",
    heading: "text-white",
    body: "text-white/75",
    card: "bg-white/5",
    cardBorder: "border-white/10",
  },
}
