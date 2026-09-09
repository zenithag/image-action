"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

import styles from "./home-two.module.css"
import { FlowPhone } from "./home-two-flow-phone"
import responsive from "./home-two-responsive.module.css"

const Arrow = () => <span aria-hidden="true">↗</span>

const audiences = [
  {
    name: "Construtoras",
    description: "Ajude compradores a visualizar acabamentos e ambientes antes da entrega.",
    before: "/images/compare/planejados/antes.webp",
    after: "/images/compare/planejados/depois.webp",
  },
  {
    name: "Imobiliárias",
    description: "Revele o potencial de um imóvel durante a visita, anúncio ou conversa.",
    before: "/images/compare/tinta/antes.webp",
    after: "/images/compare/tinta/depois.webp",
  },
  {
    name: "Acabamentos",
    description: "Transforme uma referência de produto em uma decisão mais concreta.",
    before: "/images/compare/porcelanato/antes.webp",
    after: "/images/compare/porcelanato/depois.webp",
  },
]

export function HomeTwo() {
  const [comparison, setComparison] = useState(53)
  const [audienceComparisons, setAudienceComparisons] = useState<Record<string, number>>({})
  const audienceCard = ({ name, description, before, after }: typeof audiences[number], index: number) => {
    const audienceComparison = audienceComparisons[name] ?? 52

    return <article key={name} className={styles.audience} data-home-two-audience-card>
      <span data-home-two-audience-index>0{index + 1}</span>
      <div data-home-two-audience-image data-home-two-audience-compare>
        <Image src={before} alt={`Ambiente original para ${name}`} fill quality={100} sizes="(max-width: 800px) 92vw, 32vw" />
        <div data-home-two-audience-after style={{ clipPath: `inset(0 0 0 ${audienceComparison}%)` }}>
          <Image src={after} alt={`Simulação visual para ${name}`} fill quality={100} sizes="(max-width: 800px) 92vw, 32vw" />
        </div>
        <div data-home-two-audience-divider style={{ left: `${audienceComparison}%` }} aria-hidden="true"><span>↔</span></div>
        <span data-home-two-audience-before-label>ANTES</span><span data-home-two-audience-after-label>DEPOIS</span>
        <input data-home-two-audience-slider aria-label={`Comparar imagem original e simulação para ${name}`} type="range" min="0" max="100" value={audienceComparison} onChange={(event) => setAudienceComparisons((current) => ({ ...current, [name]: Number(event.target.value) }))} />
      </div>
      <div data-home-two-audience-content><h3>{name}</h3><p>{description}</p></div>
      <a href="#demonstracao" aria-label={`Conhecer a ComoFica para ${name}`}>Conhecer <Arrow /></a>
    </article>
  }

  return (
    <main className={`${styles.page} ${responsive.tuned}`}>
      <nav className={styles.nav} aria-label="Navegação principal">
        <Link className={styles.brand} href="/home-2" aria-label="ComoFica.ai, início">
          <Image data-home-two-logo src="/logo-horizontal-azul.svg" alt="ComoFica.ai" width={157} height={36} priority />
        </Link>
        <div className={styles.navLinks}>
          <a href="#plataforma">Plataforma</a>
          <a href="#aplicacoes">Aplicações</a>
          <a href="#como-funciona">Como funciona</a>
        </div>
        <div className={styles.navActions}>
          <Link href="/login">Entrar</Link>
          <a className={styles.navCta} href="#demonstracao">Demonstração <Arrow /></a>
        </div>
      </nav>

      <section className={styles.hero} id="plataforma" data-home-two-hero>
        <div className={styles.heroAura} />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Visualização comercial com inteligência artificial</p>
          <h1>Mostre o que o cliente ainda não consegue ver.</h1>
          <p className={styles.heroText}>Transforme produtos, acabamentos e ideias em simulações visuais para o atendimento, o site e o WhatsApp da sua empresa.</p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="#demonstracao">Agendar uma demonstração <Arrow /></a>
            <a className={styles.textButton} href="#como-funciona">Entenda o fluxo <span>↓</span></a>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="Demonstração de comparação antes e depois">
          <div className={styles.signal}>SIMULAÇÃO EM CONTEXTO <b>●</b></div>
          <div className={styles.visualFrame}>
            <Image src="/images/compare/porcelanato/antes.webp" alt="Ambiente antes da simulação" fill priority quality={100} sizes="(max-width: 800px) 92vw, 1216px" />
            <div className={styles.afterLayer} style={{ clipPath: `inset(0 0 0 ${comparison}%)` }}>
              <Image src="/images/compare/porcelanato/depois.webp" alt="Simulação de porcelanato aplicada ao ambiente" fill priority quality={100} sizes="(max-width: 800px) 92vw, 1216px" />
            </div>
            <div className={styles.compareLine} style={{ left: `${comparison}%` }}><span>↔</span></div>
            <span className={styles.beforeLabel}>ORIGINAL</span><span className={styles.afterLabel}>SIMULAÇÃO</span>
            <input className={styles.slider} aria-label="Comparar imagem original e simulação" type="range" min="0" max="100" value={comparison} onChange={(event) => setComparison(Number(event.target.value))} />
          </div>
          <div className={styles.visualCaption}><span>Foto do ambiente</span><strong>→</strong><span>Produto + orientação simples</span><em>Simulação visual ilustrativa</em></div>
        </div>
      </section>

      <section className={styles.strap} aria-label="Recursos principais">
        <p>UMA EXPERIÊNCIA, TRÊS CANAIS</p><span>Plataforma</span><span>Site</span><span>WhatsApp</span><span>White label</span>
      </section>

      <section className={styles.statement}>
        <div data-home-two-statement-phone><FlowPhone /></div>
        <div data-home-two-statement-copy>
          <p className={styles.kicker}>A conversa conduz a decisão</p>
          <p>O produto é a experiência de decisão: mais clareza para quem escolhe, mais contexto para quem atende.</p>
          <p data-home-two-statement-description>Uma foto, uma referência e uma orientação simples transformam a dúvida em uma comparação visual para seguir a conversa.</p>
        </div>
      </section>

      <section className={styles.flow} id="como-funciona">
        <div data-home-two-flow-heading><p className={styles.kicker}>Um fluxo que cabe na conversa</p><h2>Da dúvida ao próximo passo, sem prompt complexo.</h2></div>
        <ol>
          <li><b>01</b><h3>Mostre o ambiente</h3><p>Envie uma foto ou use a imagem que já faz parte do atendimento.</p></li>
          <li><b>02</b><h3>Defina a referência</h3><p>Selecione um item do catálogo ou envie a imagem do produto.</p></li>
          <li><b>03</b><h3>Oriente a aplicação</h3><p>Diga onde e como deseja aplicar a possibilidade.</p></li>
          <li><b>04</b><h3>Compare e avance</h3><p>Use a simulação para comparar opções e conduzir a decisão.</p></li>
        </ol>
      </section>

      <section className={styles.audiences} id="aplicacoes">
        <div data-home-two-audience-layout>
          <div data-home-two-audience-primary>
            <div className={styles.audienceHeading}><p className={styles.kicker}>Quando imaginar não basta</p><h2>Uma plataforma configurada para o contexto da sua operação.</h2><p data-home-two-audience-intro>Leve a comparação visual para os pontos de contato que fazem parte da sua operação: atendimento, catálogo, site e WhatsApp.</p></div>
            {audienceCard(audiences[0], 0)}
          </div>
          <div data-home-two-audience-secondary>
            {audiences.slice(1).map((audience, index) => audienceCard(audience, index + 1))}
          </div>
        </div>
      </section>

      <section className={styles.trust}>
        <div className={styles.trustVisual}><Image src="/images/compare/planejados/depois.webp" alt="Simulação de móveis planejados em ambiente residencial" fill sizes="(max-width: 800px) 100vw, 50vw" /></div>
        <div><p className={styles.kicker}>Não é só gerar uma imagem</p><h2>É transformar visualização em uma experiência de marca.</h2><p className={styles.trustText}>O parceiro escolhe quem usa, onde a experiência acontece e como ela se conecta ao seu catálogo, equipe e operação.</p><ul><li>Uso interno, externo ou híbrido</li><li>Histórico e organização por operação</li><li>Comparação antes/depois em uma experiência clara</li></ul></div>
      </section>

      <section className={styles.cta} id="demonstracao">
        <div data-home-two-cta-panel>
          <div data-home-two-cta-copy><p className={styles.kicker}>Vamos colocar uma decisão real na tela</p><h2>Veja a ComoFica.ai aplicada ao seu contexto.</h2><p>Uma demonstração começa com o ambiente, o produto e a dúvida que sua equipe quer resolver.</p></div>
          <div data-home-two-cta-action><span>PRÓXIMO PASSO</span><p>Comece pelo ambiente, pelo produto e pela conversa que você quer tornar mais clara.</p><a className={styles.primaryButton} href="mailto:contato@comofica.ai?subject=Agendar%20uma%20demonstração">Agendar uma demonstração <Arrow /></a></div>
        </div>
      </section>

      <footer className={styles.footer}><span className={styles.brand}>como<span>fica</span><i>.ai</i></span><p>Visualização comercial com inteligência artificial.</p><span>© 2026 ComoFica.ai</span></footer>
    </main>
  )
}
