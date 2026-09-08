import Link from "next/link"

import { Button } from "@/components/ui/button"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { CTA_MESSAGES, buildWhatsAppLink } from "@/lib/site-config"

interface LegalPlaceholderPageProps {
  eyebrow: string
  title: string
  subheadline: string
  /** O que esta página vai reunir quando publicada (Guia, tabela 4.1) — descritivo, sem antecipar cláusula. */
  scopeNote: string
}

/**
 * Privacidade e Termos (Guia, cap. 4.1 e checklist 20.6): "Publicar somente
 * após aprovação jurídica e técnica" — texto de política real não existe
 * ainda, então esta página não finge ter uma. Ela existe pra a rota do
 * rodapé não quebrar e pra deixar claro o status, sem inventar cláusula.
 */
export function LegalPlaceholderPage({ eyebrow, title, subheadline, scopeNote }: LegalPlaceholderPageProps) {
  const cta = CTA_MESSAGES.home

  return (
    <>
      <SiteHeader />

      <main id="main-content">
        <HeroByAudience
          tone="blue"
          align="center"
          eyebrow={eyebrow}
          title={title}
          subheadline={subheadline}
          primaryCta={{ label: "Falar com o time", href: buildWhatsAppLink(cta.message), external: true }}
        />

        <section className="bg-brand-mist px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl rounded-3xl border border-brand-blue/10 bg-white p-8 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-tiffany-dark">Conteúdo em finalização</p>
            <h2 className="mt-3 font-display text-xl font-semibold text-brand-blue sm:text-2xl">{scopeNote}</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              A ComoFica.ai adota diretrizes de privacidade e estrutura seus fluxos conforme a LGPD; o texto completo desta
              página será publicado aqui assim que a versão final for aprovada pelo time jurídico.
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Enquanto isso, qualquer dúvida pode ser esclarecida diretamente com o nosso time.
            </p>
            <div className="mt-6">
              <Button asChild className="bg-brand-blue text-white hover:bg-brand-blue-light">
                <Link href="/contato">Falar com o time</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
