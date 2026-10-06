import { ChannelDiagram } from "@/components/site/channel-diagram"
import { ContextualCta } from "@/components/site/contextual-cta"
import { FeatureDetail } from "@/components/site/feature-detail"
import { HeroByAudience } from "@/components/site/hero-by-audience"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { SoftwareApplicationJsonLd } from "@/components/site/software-application-jsonld"
import { StepsFlow } from "@/components/site/steps-flow"
import { TrustLimits } from "@/components/site/trust-limits"
import { UseCaseGrid } from "@/components/site/use-case-grid"
import { CTA_MESSAGES, buildWhatsAppLink } from "@/lib/site-config"

export function PlatformPage() {
  const cta = CTA_MESSAGES.plataforma

  return (
    <>
      <SiteHeader />
      <SoftwareApplicationJsonLd />

      <main id="main-content">
        <HeroByAudience
          tone="blue"
          eyebrow="A plataforma ComoFica.ai"
          title="Leve a visualização para o canal onde a decisão acontece."
          subheadline="Sua equipe e seus clientes podem transformar ambientes, produtos e possibilidades em simulações visuais pela plataforma própria, no seu site ou no seu WhatsApp - com uma experiência adaptada ao seu processo e à identidade da sua empresa."
          primaryCta={{ label: cta.label, href: buildWhatsAppLink(cta.message), external: true }}
          secondaryCta={{ label: "Explorar as formas de usar", href: "#modos-de-acesso" }}
          proofItems={["Plataforma própria", "Site da sua empresa", "WhatsApp da sua empresa", "Logo e cores da sua empresa", "Multiusuário", "Analytics"]}
          visual={<ChannelDiagram />}
        />

        <FeatureDetail
          id="diferenciais"
          tone="white"
          eyebrow="O que a sua empresa compra"
          title="Mais do que gerar uma imagem: colocar a visualização em operação."
          text="Uma assinatura genérica entrega uma IA para alguém usar. A ComoFica entrega uma experiência especializada para a sua empresa operar: canais, personalização, equipe, catálogo, históricos, regras de acesso, comparação antes/depois e acompanhamento de uso."
          highlight="A tecnologia trabalha em segundo plano. Para o usuário, a experiência deve parecer simples, clara e integrada ao atendimento."
        />

        <StepsFlow
          id="como-funciona"
          tone="mist"
          eyebrow="Fluxo principal"
          title="Ambiente, referência e uma orientação simples."
          steps={[
            { number: "01", title: "O ambiente", description: "Envie a imagem do ambiente que será transformado." },
            { number: "02", title: "A referência", description: "Selecione um item do catálogo ou envie a foto do produto de referência." },
            { number: "03", title: "A orientação", description: "Oriente onde aplicar, o que substituir ou qual alternativa visualizar." },
            { number: "04", title: "O resultado", description: "Receba a simulação e compare com a imagem original." },
          ]}
          note="A ferramenta foi configurada para pedir o mínimo de informação necessário. Não há como adivinhar a intenção do usuário, mas não é preciso construir um prompt técnico ou detalhado."
        />

        <FeatureDetail
          tone="white"
          eyebrow="Plataforma própria"
          title="Um painel para gerar, acompanhar e aprender com o uso."
          text="A interface própria pode ser acessada por smartphone, tablet, iPad ou computador. Nela, você administra usuários, gera imagens, acompanha conversas e históricos e consulta analytics da operação."
          bullets={[
            "Gerações de imagens de ambientes",
            "Múltiplos usuários por empresa",
            "Histórico de imagens e conversas",
            "Painel de analytics",
            "Comparação antes/depois",
            "Uso com catálogo ou foto de referência",
            "Logo e cores da sua empresa, com a marca ComoFica.ai sempre visível",
          ]}
        />

        <FeatureDetail
          id="site"
          tone="mist"
          eyebrow="Integração ao site"
          title="Visualização disponível para quem visita o site da sua empresa."
          text="A ComoFica pode ser integrada ao seu site para que seus clientes explorem produtos e possibilidades. Você define onde a experiência aparece, quais itens ou casos de uso ficam disponíveis e qual será o próximo passo após a simulação."
          bullets={[
            "Chamar um vendedor",
            "Solicitar uma demonstração",
            "Pedir orçamento",
            "Compartilhar o antes/depois",
            "Continuar no WhatsApp",
          ]}
        />

        <FeatureDetail
          id="whatsapp"
          tone="white"
          eyebrow="WhatsApp da sua empresa"
          title="A visualização entra no WhatsApp que sua equipe e seus clientes já utilizam."
          text="O número da sua empresa é conectado à plataforma por leitura de QR code. O atendimento humano pode continuar normalmente, e a automação pode aparecer apenas quando for necessário gerar a simulação. O resultado volta na conversa com um link para comparar antes e depois."
          bullets={[
            "Não exige que você divulgue outro número",
            "Pode ser usado apenas pela equipe ou também pelo cliente final",
            "Cada vendedor pode ter acesso próprio",
            "Conversas e imagens podem ser consultadas no histórico da sua empresa",
            "Você pode acompanhar o volume por usuário interno",
          ]}
        />

        <UseCaseGrid
          id="modos-de-acesso"
          tone="mist"
          eyebrow="Modos de acesso"
          title="Você escolhe quem usa e como usa."
          items={[
            { title: "Uso interno", description: "A equipe opera a ferramenta durante o atendimento e revisa a simulação antes de mostrar ao cliente." },
            { title: "Uso externo", description: "Clientes finais podem gerar ou solicitar simulações pelo site ou WhatsApp, conforme as regras que você definir." },
            { title: "Uso híbrido", description: "Equipe e clientes usam a experiência em momentos diferentes da jornada, com gestão central da sua empresa." },
          ]}
        />

        <FeatureDetail
          tone="white"
          eyebrow="Catálogo"
          title="Comece com o catálogo ou com uma simples foto de referência."
          text="A ComoFica não exige que todo o portfólio esteja cadastrado para começar. Você pode selecionar produtos estratégicos, mais vendidos ou que geram mais dúvida. Também é possível enviar uma imagem do produto no momento da geração."
          bullets={[
            "O usuário seleciona o produto dentro do fluxo",
            "A simulação pode permanecer associada ao SKU e ao preço",
            "Você mantém o catálogo atualizado",
            "A ComoFica pode realizar a carga inicial e oferecer suporte de manutenção sob acordo comercial",
          ]}
          note="Estoque em tempo real não é uma função padrão confirmada. Caso necessário, depende de integração sob demanda."
        />

        <TrustLimits
          tone="mist"
          title="O usuário escolhe o resultado. A ComoFica administra a tecnologia."
          text="A ComoFica utiliza fornecedores externos de inteligência artificial e administra internamente a seleção, a configuração e a contingência. Se o fornecedor principal apresentar falha, a plataforma pode recorrer a uma alternativa secundária. O usuário não precisa escolher modelos ou acompanhar mudanças técnicas."
        />

        <FeatureDetail
          tone="white"
          eyebrow="Integrações"
          title="Integrações quando o processo justificar."
          text="Conexões com CRM, ERP, estoque e e-commerce podem ser desenvolvidas sob demanda. Cada projeto depende do sistema, da API, da autenticação, dos dados necessários, das regras de segurança, do suporte e do resultado esperado."
        />

        <ContextualCta
          tone="blue"
          title="Veja a plataforma, o site e o WhatsApp funcionando no mesmo fluxo."
          text="Em uma demonstração, você acompanha uma geração completa, o antes/depois, os modos de acesso e a personalização com a identidade da sua empresa."
          ctaLabel={cta.label}
          ctaHref={buildWhatsAppLink(cta.message)}
        />
      </main>

      <SiteFooter />
    </>
  )
}
