import { DemoRequestForm } from "@/components/site/demo-request-form"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { CTA_MESSAGES, buildWhatsAppLink } from "@/lib/site-config"

export function ContatoPage() {
  const cta = CTA_MESSAGES.home

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <HeroByAudience
          tone="blue"
          align="center"
          eyebrow="Contato"
          title="Agende uma demonstração com um caso real."
          subheadline="Conte qual decisão visual sua empresa precisa facilitar. Se possível, separe uma imagem, produto, imóvel ou ambiente para a demonstração."
          primaryCta={{ label: cta.label, href: buildWhatsAppLink(cta.message), external: true }}
          microcopy="Prefere WhatsApp direto? O botão acima já abre a conversa."
        />

        <section className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-tiffany-dark">Alternativa ao WhatsApp</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-blue sm:text-4xl">
              Ou preencha um formulário rápido
            </h2>
          </div>

          <div className="mt-12">
            <DemoRequestForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
