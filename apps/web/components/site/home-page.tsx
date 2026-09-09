import { BeforeAfterDemo } from "@/components/site/before-after-demo"
import { ChannelCards } from "@/components/site/channel-cards"
import { ContextualCta } from "@/components/site/contextual-cta"
import { DifferentiationBlock } from "@/components/site/differentiation-block"
import { FaqAccordion } from "@/components/site/faq-accordion"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { OrganizationJsonLd } from "@/components/site/organization-jsonld"
import { ProblemSection } from "@/components/site/problem-section"
import { ProofStrip } from "@/components/site/proof-strip"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { StepsFlow } from "@/components/site/steps-flow"
import { TrustLimits } from "@/components/site/trust-limits"
import { UseCaseGrid } from "@/components/site/use-case-grid"
import { CTA_MESSAGES, buildWhatsAppLink } from "@/lib/site-config"

const heroDemoItem = {
  id: "porcelanato-hero",
  tabLabel: "Acabamento",
  before: { src: "/images/compare/porcelanato/antes-hq.png", alt: "Ambiente original, antes da simulação" },
  after: { src: "/images/compare/porcelanato/depois-hq.png", alt: "Simulação de porcelanato aplicada ao ambiente" },
}

const demoItems = [
  {
    id: "acabamento",
    tabLabel: "Acabamento",
    before: { src: "/images/compare/porcelanato/antes-hq.png", alt: "Ambiente original, antes da simulação de acabamento" },
    after: { src: "/images/compare/porcelanato/depois-hq.png", alt: "Simulação de porcelanato aplicada ao ambiente" },
  },
  {
    id: "mobiliario",
    tabLabel: "Mobiliário",
    before: { src: "/images/compare/planejados/antes.jpg", alt: "Ambiente original, antes da simulação de móveis planejados" },
    after: { src: "/images/compare/planejados/depois.png", alt: "Simulação de móveis planejados no ambiente" },
  },
  {
    id: "ambientacao",
    tabLabel: "Ambientação",
    before: { src: "/images/compare/tinta/antes.jpg", alt: "Ambiente original, antes da simulação de pintura" },
    after: { src: "/images/compare/tinta/depois.png", alt: "Simulação de pintura aplicada ao ambiente" },
  },
  {
    id: "construcao-reforma",
    tabLabel: "Construção e Reforma",
    before: {
      src: "/images/compare/construcao/antes.webp",
      alt: "Unidade em fase de acabamento bruto, com contrapiso e paredes sem pintura, antes da simulação",
    },
    after: {
      src: "/images/compare/construcao/depois.webp",
      alt: "Simulação da mesma unidade pronta e decorada, com piso, pintura e mobiliário",
    },
  },
]

const marketPages = [
  {
    title: "Construtoras e incorporadoras",
    description:
      "Ajude o comprador a visualizar acabamentos, personalizações, ambientações e possibilidades do imóvel antes da obra, da entrega ou da decisão.",
    href: "/solucoes/construtoras-incorporadoras",
    linkLabel: "Ver solução para construtoras",
  },
  {
    title: "Imobiliárias e corretores",
    description: "Mostre o potencial do imóvel durante a visita, no anúncio ou no WhatsApp: mobiliado, reformado ou adaptado ao estilo do comprador.",
    href: "/solucoes/imobiliarias-corretores",
    linkLabel: "Ver solução para imobiliárias",
  },
  {
    title: "Acabamentos e revestimentos",
    description: "Aplique pisos, pedras, tintas, revestimentos e outros produtos no ambiente real do cliente, usando catálogo ou foto de referência.",
    href: "/solucoes/acabamentos-revestimentos",
    linkLabel: "Ver solução para acabamentos",
  },
  {
    title: "Móveis e decoração",
    description: "Ajude o cliente a explorar móveis, iluminação e composições no próprio espaço antes de escolher.",
    href: "/solucoes/moveis-decoracao",
    linkLabel: "Ver solução para móveis",
  },
  {
    title: "Moda e provador virtual",
    description: "Explore projetos de visualização para peças e combinações com escopo, privacidade e transparência definidos caso a caso.",
    href: "/solucoes/moda-provador-virtual",
    linkLabel: "Conhecer possibilidades futuras",
    badge: "Aplicação futura",
  },
]

const homeFaq = [
  {
    question: "O que é a ComoFica.ai?",
    answer:
      "É uma plataforma de visualização comercial com IA que ajuda empresas, equipes e clientes a ver como produtos, acabamentos e ideias podem ficar em ambientes antes da decisão.",
  },
  {
    question: "Onde a experiência funciona?",
    answer:
      "Na plataforma própria, integrada ao site do parceiro e no WhatsApp da empresa. O cliente escolhe quais canais ativar e quem terá acesso.",
  },
  {
    question: "Preciso cadastrar um catálogo?",
    answer:
      "Não. É possível usar uma foto de referência do produto. Quando o catálogo está configurado, a simulação pode permanecer associada ao produto, SKU e preço.",
  },
  {
    question: "É necessário saber criar prompts?",
    answer: "Não. O fluxo foi configurado para pedir apenas a orientação essencial: o que aplicar, onde aplicar ou o que substituir.",
  },
  {
    question: "Quanto tempo leva uma geração?",
    answer: "Normalmente, cerca de 10 a 20 segundos. Em alguns casos, pode levar até um minuto.",
  },
  {
    question: "A imagem é igual ao resultado real?",
    answer:
      "Não deve ser tratada como garantia. A configuração busca preservar o contexto e representar a possibilidade com realismo, mas materiais, medidas, disponibilidade e especificações precisam ser validados.",
  },
  {
    question: "A ComoFica substitui um profissional?",
    answer: "Não. Ela acelera exploração e comunicação; projeto, medição, especificação e responsabilidade técnica permanecem com os profissionais habilitados.",
  },
  {
    question: "Por que usar a ComoFica em vez de apenas uma IA genérica?",
    answer:
      "Uma IA genérica atende muitas tarefas. A ComoFica organiza um trabalho específico com fluxo intuitivo, marca do parceiro, catálogo, equipe, histórico, analytics, site, WhatsApp e antes/depois.",
  },
  {
    question: "A plataforma pode integrar com outros sistemas?",
    answer: "Integrações com ERP, CRM, estoque e e-commerce podem ser desenvolvidas sob demanda, conforme o sistema, as APIs, a segurança e o escopo comercial.",
  },
  {
    question: "Quanto custa?",
    answer:
      "O investimento depende do volume de gerações, canais, usuários, catálogo, implantação e serviços necessários. A proposta vigente é apresentada após a demonstração e o entendimento do caso de uso.",
  },
]

export function HomePage() {
  const homeCta = CTA_MESSAGES.home

  return (
    <>
      <OrganizationJsonLd />
      <SiteHeader />

      <main id="main-content">
        <HeroByAudience
          tone="white"
          eyebrow="Plataforma de visualização comercial com IA"
          title="Mostre o que o cliente ainda não consegue ver."
          subheadline="A ComoFica.ai transforma fotos de ambientes, produtos e possibilidades em simulações visuais prontas para apoiar a decisão - pela plataforma da empresa, no site ou no WhatsApp, com a marca do parceiro."
          primaryCta={{ label: homeCta.label, href: buildWhatsAppLink(homeCta.message), external: true }}
          secondaryCta={{ label: "Ver como funciona", href: "#como-funciona" }}
          microcopy="Faça a demonstração com uma imagem, produto ou imóvel do seu negócio."
          proofItems={["Plataforma própria", "Integração ao site", "WhatsApp da empresa", "White label"]}
          visual={<BeforeAfterDemo tone="white" items={[heroDemoItem]} caption="Simulação visual ilustrativa" />}
        />

        <ProofStrip
          label="Uma experiência, três canais"
          items={["Plataforma", "Site", "WhatsApp", "White label"]}
        />

        {/* 6.3 Demonstração principal */}
        <section className="bg-brand-blue pb-20 pt-16 text-white lg:pb-28 lg:pt-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Da dúvida para uma possibilidade visual, em segundos.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-white/75">
              Envie uma imagem do ambiente, escolha um produto do catálogo ou use uma foto de referência e diga o que
              deseja visualizar. A ComoFica é configurada para entender orientações simples, preservar o contexto e
              alterar o que foi solicitado.
            </p>
          </div>
          <div className="mx-auto mt-10 max-w-4xl px-4 sm:px-6 lg:px-8">
            <BeforeAfterDemo items={demoItems} caption="Simulação visual ilustrativa. Confirme materiais, medidas e especificações antes da decisão final." />
          </div>
        </section>

        <ProblemSection
          tone="white"
          eyebrow="O problema"
          title="Quando o cliente não consegue visualizar, a decisão perde força."
          text='Plantas, amostras, fotos e explicações são importantes, mas nem sempre respondem à pergunta pessoal do cliente: "como isso ficaria para mim?". Sem uma referência visual, a conversa pode se alongar, a comparação fica abstrata e o atendimento perde a oportunidade de personalizar a decisão.'
          cards={[
            { title: "Explicação demais", description: "A equipe tenta traduzir uma possibilidade visual apenas com palavras." },
            { title: "Processo interrompido", description: "O cliente precisa sair da conversa para imaginar, pedir opinião ou buscar outra referência." },
            { title: "Pouca personalização", description: "O material é o mesmo para todos, mesmo quando a dúvida é individual." },
          ]}
        />

        {/* 6.5 Definição */}
        <section className="bg-brand-mist px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-tiffany-dark">A nova possibilidade</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-blue sm:text-4xl">
              Uma camada visual dentro da jornada que sua empresa já possui.
            </h2>
            <p className="mt-5 text-lg leading-7 text-muted-foreground">
              A ComoFica.ai é uma plataforma de visualização comercial com inteligência artificial. Ela transforma
              produtos, acabamentos e ideias em simulações visuais no contexto de um ambiente, sem exigir prompts
              complexos e sem obrigar a empresa a abandonar seus canais atuais.
            </p>
            <p className="mt-4 font-medium text-brand-blue">
              O valor não está apenas na imagem gerada. Está em tornar a visualização acessível à equipe, ao cliente e
              ao processo comercial.
            </p>
          </div>
        </section>

        <StepsFlow
          id="como-funciona"
          tone="white"
          eyebrow="Como funciona"
          title="Quatro passos para transformar uma pergunta em visualização."
          steps={[
            { number: "01", title: "O ambiente", description: "A equipe ou o cliente envia uma foto, imagem aprovada ou render de referência." },
            { number: "02", title: "O produto ou a possibilidade", description: "Escolha um item do catálogo ou envie outra imagem como referência." },
            { number: "03", title: "Uma orientação simples", description: "Diga onde aplicar, o que substituir ou qual alternativa deseja explorar." },
            { number: "04", title: "O resultado", description: "Receba a simulação, compare antes/depois e continue o atendimento." },
          ]}
          note="As gerações normalmente ficam prontas em cerca de 10 a 20 segundos; em alguns casos, podem levar até um minuto."
        />

        <ChannelCards
          tone="mist"
          eyebrow="Formas de usar"
          title="Uma plataforma. Três formas de colocar a visualização em operação."
          channels={[
            {
              title: "Plataforma própria",
              description:
                "Sua equipe acessa pelo celular, tablet ou computador, gera simulações, acompanha históricos, administra usuários e consulta analytics em um painel com a marca da empresa.",
              linkLabel: "Conhecer a plataforma",
              href: "/plataforma",
            },
            {
              title: "Integração ao site",
              description:
                "A experiência pode ser incorporada ao site do parceiro para que clientes externos explorem produtos e possibilidades sem depender do atendimento presencial.",
              linkLabel: "Ver uso no site",
              href: "/plataforma#site",
            },
            {
              title: "WhatsApp da empresa",
              description:
                "A solicitação pode acontecer no número que a empresa já utiliza. A equipe mantém o atendimento humano e ativa a geração quando fizer sentido, com o resultado devolvido na conversa.",
              linkLabel: "Ver uso no WhatsApp",
              href: "/plataforma#whatsapp",
            },
          ]}
          footerNote="Uso apenas pela equipe · Uso pelos clientes · Modelo híbrido"
        />

        <UseCaseGrid tone="white" id="solucoes" eyebrow="Soluções" title="A mesma tecnologia, aplicada ao jeito de cada mercado decidir." items={marketPages} />

        <DifferentiationBlock
          tone="mist"
          eyebrow="Por que ComoFica.ai"
          title="Não é apenas acesso a uma IA. É uma experiência pronta para a operação da empresa."
          bullets={[
            "Sem prompts complexos: fluxo configurado para aplicação de produtos e possibilidades.",
            "Com a sua marca: experiência white label para equipe e clientes finais.",
            "Catálogo opcional: use SKU e preço quando configurados ou comece com uma foto de referência.",
            "Equipe organizada: múltiplos usuários, histórico de gerações, gestão e analytics.",
            "Antes/depois compartilhável: slider e visualização lado a lado para continuar a conversa.",
            "Tecnologia administrada: a ComoFica seleciona e alterna fornecedores para preservar qualidade e continuidade.",
          ]}
          link={{ label: "Comparar com uma assinatura genérica de IA", href: "/plataforma#diferenciais" }}
        />

        <TrustLimits
          tone="white"
          title="Acelera a exploração. Preserva a decisão técnica."
          text="A ComoFica não substitui arquitetos, designers, projetistas, engenheiros, corretores ou vendedores. Ela ajuda esses profissionais a explorar alternativas rapidamente, comunicar possibilidades com clareza e concentrar o trabalho detalhado no que realmente avançará."
        />

        <FaqAccordion tone="mist" id="perguntas" eyebrow="Dúvidas comuns" title="Perguntas frequentes" items={homeFaq} />

        <ContextualCta
          id="demonstracao"
          title="Escolha um caso real. Nós mostramos como pode ficar."
          text="Traga uma imagem, um produto, um imóvel ou um ambiente do seu negócio. Em uma demonstração contextual, você conhece o fluxo, os três canais e as possibilidades para sua operação."
          ctaLabel={homeCta.label}
          ctaHref={buildWhatsAppLink(homeCta.message)}
          microcopy="Sem promessas genéricas. A conversa começa pela realidade da sua empresa."
        />
      </main>

      <SiteFooter />
    </>
  )
}
