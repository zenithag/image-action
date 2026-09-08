import { ContextualCta } from "@/components/site/contextual-cta"
import { FaqAccordion } from "@/components/site/faq-accordion"
import { FaqJsonLd } from "@/components/site/faq-jsonld"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { FAQ_GROUPS } from "@/lib/faq-content"
import { CTA_MESSAGES, buildWhatsAppLink } from "@/lib/site-config"

export function FaqPage() {
  const cta = CTA_MESSAGES.home
  const allFaqItems = FAQ_GROUPS.flatMap((group) => group.items)

  return (
    <>
      <SiteHeader />
      <FaqJsonLd items={allFaqItems} />

      <main id="main-content">
        <HeroByAudience
          tone="white"
          align="center"
          eyebrow="Central de ajuda"
          title="Entenda como funcionam as simulações, os canais, o catálogo e os limites da ComoFica.ai."
          subheadline="Perguntas organizadas por tema — da primeira simulação à privacidade dos dados."
          primaryCta={{ label: cta.label, href: buildWhatsAppLink(cta.message), external: true }}
        />

        {FAQ_GROUPS.map((group, index) => (
          <FaqAccordion
            key={group.title}
            tone={index % 2 === 0 ? "mist" : "white"}
            title={group.title}
            items={group.items}
          />
        ))}

        <ContextualCta
          tone="blue"
          title="Não achou a resposta que precisava?"
          text="Fale diretamente com a equipe pelo WhatsApp — conte o seu caso e a gente responde com contexto."
          ctaLabel={cta.label}
          ctaHref={buildWhatsAppLink(cta.message)}
        />
      </main>

      <SiteFooter />
    </>
  )
}
