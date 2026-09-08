import { BreadcrumbJsonLd, Breadcrumbs } from "@/components/site/breadcrumbs"
import { ContextualCta } from "@/components/site/contextual-cta"
import { FaqAccordion, type FaqItem } from "@/components/site/faq-accordion"
import { FaqJsonLd } from "@/components/site/faq-jsonld"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { ProblemSection } from "@/components/site/problem-section"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { TrustLimits } from "@/components/site/trust-limits"
import { CTA_MESSAGES, buildWhatsAppLink } from "@/lib/site-config"

const BREADCRUMB_ITEMS = [{ label: "Início", href: "/" }, { label: "Soluções" }, { label: "Moda e provador virtual" }]

const MODA_FAQ_ITEMS: FaqItem[] = [
  {
    question: "O provador virtual já é o foco principal da ComoFica?",
    answer:
      "Não. O foco atual está em construtoras, imobiliárias, acabamentos e móveis. Projetos de moda são avaliados conforme necessidade e aderência técnica.",
  },
  {
    question: "A experiência pode usar fotos de pessoas?",
    answer:
      "Pode ser tecnicamente possível, mas exige avaliação de consentimento, finalidade, privacidade, direitos de imagem, fornecedores e retenção antes da implantação.",
  },
  {
    question: "A imagem mostra o caimento exato?",
    answer: "Não. A visualização é ilustrativa e não substitui prova física, medidas, tabela de tamanhos ou características do tecido.",
  },
  {
    question: "É possível integrar ao site ou WhatsApp?",
    answer: "Esses canais fazem parte da arquitetura da ComoFica, mas a aplicação em moda depende de projeto e validação específicos.",
  },
]

/**
 * Página de Moda e provador virtual (Guia, cap. 12) — status FUTURO: a quinta
 * prioridade, "não deve ocupar o mesmo destaque dos quatro primeiros ICPs nem
 * afirmar que existe um provador virtual padronizado e pronto para escala"
 * (12.1). Por isso o hero não usa BeforeAfterDemo (não existe conjunto de
 * imagens real pra essa vertical) e leva o selo "Aplicação futura e projetos
 * sob avaliação" (12.3).
 */
export function ModaPage() {
  const cta = CTA_MESSAGES["moda-provador-virtual"]
  const ctaHref = buildWhatsAppLink(cta.message)

  return (
    <>
      <SiteHeader />
      <BreadcrumbJsonLd items={BREADCRUMB_ITEMS} />
      <FaqJsonLd items={MODA_FAQ_ITEMS} />
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <main id="main-content">
        <HeroByAudience
          tone="blue"
          align="center"
          badge="Aplicação futura e projetos sob avaliação"
          eyebrow="ComoFica.ai para moda"
          title="Experiências visuais para moda começam antes do provador."
          subheadline="A ComoFica.ai avalia projetos para ajudar clientes a visualizar peças, acessórios e combinações antes da decisão, com tecnologia, consentimento, privacidade e transparência definidos caso a caso."
          primaryCta={{ label: cta.label, href: ctaHref, external: true }}
        />

        <ProblemSection
          tone="white"
          eyebrow="Possibilidades"
          title="Onde a visualização para moda pode ajudar"
          text="Projetos avaliados caso a caso, com escopo técnico e jurídico definido antes de qualquer implantação."
          bullets={[
            "Visualização de peças e combinações",
            "Experimentação de cores, estampas e acessórios",
            "Aplicações para consultoras, lojas e equipes de atendimento",
            "Experiências externas integradas ao site ou WhatsApp",
            "Ótica e outras categorias adjacentes, sujeitas a validação específica",
          ]}
        />

        <TrustLimits
          tone="mist"
          title="A imagem do cliente exige mais cuidado do que uma foto de ambiente."
          text="Projetos de moda podem envolver imagem corporal, biometria, consentimento e expectativa sobre caimento. Antes da comercialização, cada aplicação precisa definir finalidade, base legal, transparência, retenção, exclusão, direitos de imagem, qualidade esperada e limites do resultado."
        />

        <TrustLimits
          tone="white"
          title="Visualização de estilo não é garantia de caimento."
          text="Uma simulação pode ajudar a explorar cor, combinação e aparência geral, mas não garante tamanho, ajuste, tecido, conforto ou resultado físico. A peça real e as informações do fabricante permanecem determinantes."
        />

        <FaqAccordion tone="mist" title="Perguntas sobre moda e provador virtual" items={MODA_FAQ_ITEMS} />

        <ContextualCta
          tone="blue"
          title="Tem um caso de uso claro para moda? Vamos avaliar juntos."
          text="Conte qual experiência deseja criar, quem usará, quais imagens serão tratadas e qual decisão precisa ser apoiada. A conversa começa pelo escopo, não por uma promessa genérica."
          ctaLabel={cta.label}
          ctaHref={ctaHref}
        />
      </main>

      <SiteFooter />
    </>
  )
}
