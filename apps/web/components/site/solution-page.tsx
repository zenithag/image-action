import { BeforeAfterDemo } from "@/components/site/before-after-demo"
import { BreadcrumbJsonLd, Breadcrumbs } from "@/components/site/breadcrumbs"
import { ChannelCards } from "@/components/site/channel-cards"
import { ContextualCta } from "@/components/site/contextual-cta"
import { FaqAccordion } from "@/components/site/faq-accordion"
import { FaqJsonLd } from "@/components/site/faq-jsonld"
import { FeatureDetail } from "@/components/site/feature-detail"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { ProblemSection } from "@/components/site/problem-section"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { StepsFlow } from "@/components/site/steps-flow"
import { TrustLimits } from "@/components/site/trust-limits"
import { UseCaseGrid } from "@/components/site/use-case-grid"
import { CTA_MESSAGES, SOLUTIONS, buildWhatsAppLink } from "@/lib/site-config"
import type { SolutionPageContent } from "@/lib/solutions-content"

/**
 * Renderizador genérico das páginas de segmento/ICP (Guia, cap. 8-11). A
 * sequência de blocos é fixa e igual pras 4 páginas — só o conteúdo muda,
 * vindo de `lib/solutions-content.ts` (Guia, cap. 19.6: "modelo de dados
 * sugerido"). Evita duplicar ~90% do JSX quatro vezes.
 */
export function SolutionPage({ content }: { content: SolutionPageContent }) {
  const cta = CTA_MESSAGES[content.ctaKey]
  const ctaHref = buildWhatsAppLink(cta.message)
  const solution = SOLUTIONS.find((s) => s.slug === content.ctaKey)
  const breadcrumbItems = [{ label: "Início", href: "/" }, { label: "Soluções" }, { label: solution?.label ?? content.hero.eyebrow }]

  return (
    <>
      <SiteHeader />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <FaqJsonLd items={content.faq.items} />
      <Breadcrumbs items={breadcrumbItems} />

      <main id="main-content">
        <HeroByAudience
          tone="blue"
          eyebrow={content.hero.eyebrow}
          title={content.hero.title}
          subheadline={content.hero.subheadline}
          primaryCta={{ label: cta.label, href: ctaHref, external: true }}
          secondaryCta={{ label: content.hero.secondaryCtaLabel, href: content.hero.secondaryCtaHref }}
          microcopy={content.hero.microcopy}
          visual={<BeforeAfterDemo tone="blue" items={content.hero.demoItems} caption="Simulação visual ilustrativa" />}
        />

        <ProblemSection
          tone="white"
          eyebrow={content.problem.eyebrow}
          title={content.problem.title}
          text={content.problem.text}
          bullets={content.problem.bullets}
        />

        <FeatureDetail
          id={content.proposta.id}
          tone="mist"
          eyebrow={content.proposta.eyebrow}
          title={content.proposta.title}
          text={content.proposta.text}
          tags={content.proposta.tags}
        />

        <UseCaseGrid
          id={content.useCases.id}
          tone="white"
          eyebrow={content.useCases.eyebrow}
          title={content.useCases.title}
          items={content.useCases.items}
        />

        <StepsFlow
          id={content.flow.id}
          tone="mist"
          eyebrow={content.flow.eyebrow}
          title={content.flow.title}
          steps={content.flow.steps}
        />

        <ChannelCards tone="white" eyebrow={content.channels.eyebrow} title={content.channels.title} channels={content.channels.channels} />

        <TrustLimits tone="mist" title={content.complementaridade.title} text={content.complementaridade.text} />

        <UseCaseGrid tone="white" eyebrow={content.valorPorFuncao.eyebrow} title={content.valorPorFuncao.title} items={content.valorPorFuncao.items} />

        <TrustLimits tone="mist" title={content.confiancaLimites.title} text={content.confiancaLimites.text} />

        <FaqAccordion id={content.faq.id} tone="white" eyebrow={content.faq.eyebrow} title={content.faq.title} items={content.faq.items} />

        <ContextualCta
          tone="blue"
          title={content.ctaFinal.title}
          text={content.ctaFinal.text}
          ctaLabel={cta.label}
          ctaHref={ctaHref}
        />
      </main>

      <SiteFooter />
    </>
  )
}
