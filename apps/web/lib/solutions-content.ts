import type { BeforeAfterItem } from "@/components/site/before-after-demo"
import type { FaqItem } from "@/components/site/faq-accordion"
import type { CtaPageKey } from "@/lib/site-config"

export interface SolutionPageContent {
  ctaKey: CtaPageKey
  hero: {
    eyebrow: string
    title: string
    subheadline: string
    secondaryCtaLabel: string
    secondaryCtaHref: string
    microcopy?: string
    demoItems: BeforeAfterItem[]
  }
  problem: {
    eyebrow: string
    title: string
    text: string
    bullets?: string[]
  }
  proposta: {
    id?: string
    eyebrow: string
    title: string
    text: string
    tags?: string[]
  }
  flow: {
    id?: string
    eyebrow: string
    title: string
    steps: { number: string; title: string; description: string }[]
  }
  useCases: {
    id?: string
    eyebrow: string
    title: string
    items: { title: string; description: string }[]
  }
  channels: {
    eyebrow: string
    title: string
    channels: { title: string; description: string }[]
  }
  complementaridade: {
    title: string
    text: string
  }
  valorPorFuncao: {
    eyebrow: string
    title: string
    items: { title: string; description: string }[]
  }
  confiancaLimites: {
    title: string
    text: string
  }
  faq: {
    id?: string
    eyebrow: string
    title: string
    items: FaqItem[]
  }
  ctaFinal: {
    title: string
    text: string
  }
}

const porcelanato: BeforeAfterItem = {
  id: "porcelanato",
  tabLabel: "Acabamento",
  before: { src: "/images/compare/porcelanato/antes.webp", alt: "Ambiente original, antes da simulação" },
  after: { src: "/images/compare/porcelanato/depois.webp", alt: "Simulação de porcelanato aplicada ao ambiente" },
}

const planejados: BeforeAfterItem = {
  id: "planejados",
  tabLabel: "Móveis planejados",
  before: { src: "/images/compare/planejados/antes.webp", alt: "Ambiente original, antes da simulação de móveis planejados" },
  after: { src: "/images/compare/planejados/depois.webp", alt: "Simulação de móveis planejados no ambiente" },
}

const tinta: BeforeAfterItem = {
  id: "tinta",
  tabLabel: "Reforma e pintura",
  before: { src: "/images/compare/tinta/antes.webp", alt: "Ambiente original, antes da simulação de pintura" },
  after: { src: "/images/compare/tinta/depois.webp", alt: "Simulação de pintura aplicada ao ambiente" },
}

export const CONSTRUTORAS_CONTENT: SolutionPageContent = {
  ctaKey: "construtoras-incorporadoras",
  hero: {
    eyebrow: "ComoFica.ai para construtoras e incorporadoras",
    title: "Ajude o comprador a enxergar o imóvel antes de tudo estar pronto.",
    subheadline:
      "Leve acabamentos, personalizações, ambientações e possibilidades do empreendimento para o stand, o site e o WhatsApp - em uma experiência visual com a marca da construtora.",
    secondaryCtaLabel: "Explorar aplicações",
    secondaryCtaHref: "#aplicacoes",
    microcopy: "A demonstração pode usar um ambiente, uma imagem ou um render autorizado do seu projeto.",
    demoItems: [planejados],
  },
  problem: {
    eyebrow: "O problema",
    title: "O empreendimento é o mesmo. A dúvida de cada comprador é diferente.",
    text: 'Plantas, memoriais, renders e decorados apresentam o projeto. Mas o comprador ainda precisa relacionar o produto ao próprio gosto, à própria rotina e às escolhas que terá de fazer. Quando a pergunta é "como ficaria com este acabamento ou neste estilo?", uma resposta estática pode não ser suficiente.',
    bullets: [
      "Escolhas abstratas de acabamento e personalização",
      "Dificuldade de interpretar ambientes ainda não executados",
      "Variações demais para produzir um render tradicional para cada conversa",
      "Intervalo entre a dúvida do comprador e a resposta da equipe",
    ],
  },
  proposta: {
    id: "diferenciais",
    eyebrow: "A proposta",
    title: "Uma camada rápida de visualização dentro da jornada imobiliária.",
    text: "A ComoFica transforma imagens aprovadas, fotos e renders de referência em simulações visuais para o atendimento. O corretor pode explorar alternativas com o comprador, o cliente pode interagir pelo site ou pelo WhatsApp e a empresa acompanha a experiência em um painel comum.",
    tags: ["Stand de vendas", "Site do empreendimento", "WhatsApp", "Personalização", "Relacionamento"],
  },
  flow: {
    id: "fluxo",
    eyebrow: "Fluxo no empreendimento",
    title: "Da imagem aprovada à conversa personalizada.",
    steps: [
      { number: "01", title: "Seleção", description: "A construtora seleciona ambientes, renders e acabamentos permitidos." },
      { number: "02", title: "Referência", description: "A equipe escolhe um produto do catálogo ou envia uma referência." },
      { number: "03", title: "Orientação", description: "O corretor ou o comprador orienta a possibilidade que deseja visualizar." },
      { number: "04", title: "Simulação", description: "A simulação fica pronta para comparação, compartilhamento e continuidade da jornada." },
    ],
  },
  useCases: {
    id: "aplicacoes",
    eyebrow: "Casos de uso",
    title: "Da apresentação do lançamento ao relacionamento pós-venda.",
    items: [
      { title: "Lançamento", description: "Apresente estilos, ambientações e possibilidades sobre imagens autorizadas do empreendimento para ajudar o comprador a interpretar a proposta." },
      { title: "Stand de vendas", description: "O corretor usa tablet ou computador para responder uma preferência durante a conversa, sem interromper o atendimento." },
      { title: "Site", description: "Permita que o visitante explore possibilidades antes ou depois do contato e chegue à equipe com uma dúvida mais concreta." },
      { title: "WhatsApp", description: "Transforme uma pergunta sobre acabamento, mobiliário ou ambiente em simulação visual durante o atendimento." },
      { title: "Personalização e upgrades", description: "Compare pisos, pedras, cores, iluminação, marcenaria e pacotes de maior valor antes da escolha formal." },
      { title: "Relacionamento", description: "Registre alternativas, compartilhe o antes/depois e retome a conversa com contexto visual." },
    ],
  },
  channels: {
    eyebrow: "Três canais",
    title: "A mesma experiência no stand, no site e no WhatsApp.",
    channels: [
      { title: "No stand", description: "Corretores e consultores operam a plataforma em tablet, smartphone ou computador, com acesso individual e histórico." },
      { title: "No site", description: "O comprador explora opções externas em uma interface integrada ao empreendimento e à identidade da construtora." },
      { title: "No WhatsApp", description: "A simulação entra na conversa que já acontece entre equipe e comprador, sem exigir automação integral do atendimento." },
    ],
  },
  complementaridade: {
    title: "Complementa renders, decorados e configuradores 3D.",
    text: "Renders e configuradores estruturados são valiosos para apresentar e formalizar o produto. A ComoFica ocupa outro momento: explora variações rápidas baseadas em imagens, responde perguntas individuais e leva a visualização para o atendimento cotidiano. Ela não substitui documentação de engenharia, memorial ou seleção contratual.",
  },
  valorPorFuncao: {
    eyebrow: "Valor para cada função",
    title: "Um caso de uso com valor claro em cada área.",
    items: [
      { title: "Diretoria comercial", description: "Transforme tecnologia em padrão de atendimento e experiência de marca." },
      { title: "Marketing", description: "Amplie a vida útil de imagens e renders com aplicações contextualizadas." },
      { title: "Inovação", description: "Implante um caso de uso mensurável sem começar por uma transformação excessivamente ampla." },
      { title: "Gerência de vendas", description: "Dê à equipe um fluxo consistente para responder a dúvidas visuais." },
      { title: "Corretor", description: "Quando o comprador não conseguir imaginar, mostre uma possibilidade na hora." },
      { title: "Personalização", description: "Torne escolhas preliminares mais concretas antes da validação formal." },
    ],
  },
  confiancaLimites: {
    title: "Visualização para a conversa. Documentos oficiais para o compromisso.",
    text: "A simulação não substitui memorial descritivo, projeto executivo, compatibilização, disponibilidade, preço, prazo de obra ou compromisso contratual. Imagens de empreendimentos devem ser autorizadas e identificadas como ilustrativas quando aplicável.",
  },
  faq: {
    id: "perguntas",
    eyebrow: "Dúvidas comuns",
    title: "Perguntas frequentes",
    items: [
      { question: "A ComoFica substitui os renders do empreendimento?", answer: "Não. Ela complementa renders e imagens aprovadas com variações rápidas para atendimento, site e WhatsApp." },
      { question: "O comprador pode usar sozinho?", answer: "Pode, se a construtora optar pelo acesso externo. Também é possível restringir o uso à equipe ou adotar um modelo híbrido." },
      { question: "A experiência pode ter a marca da construtora?", answer: "Sim. O white label permite destacar a identidade do parceiro para equipe e compradores, conforme o escopo do projeto." },
      { question: "É possível associar acabamentos e preços?", answer: "Quando o catálogo está configurado, a simulação pode permanecer associada ao produto, SKU e preço. Regras comerciais e disponibilidade devem ser confirmadas nos sistemas oficiais." },
      { question: "A ComoFica serve para personalização de unidades?", answer: "Serve para explorar e comunicar alternativas preliminares. A escolha formal continua sujeita a memorial, compatibilidade, disponibilidade, preço e processo contratual." },
      { question: "Podemos integrar com CRM ou sistemas do empreendimento?", answer: "Integrações podem ser desenvolvidas sob demanda, depois da avaliação de API, dados, segurança, suporte e resultado esperado." },
    ],
  },
  ctaFinal: {
    title: "Traga um ambiente do empreendimento. Vamos transformar uma dúvida em demonstração.",
    text: "Escolha uma imagem autorizada e uma possibilidade que seus compradores costumam perguntar. A demonstração mostra o fluxo completo, os três canais e o uso com a marca da construtora.",
  },
}

export const IMOBILIARIAS_CONTENT: SolutionPageContent = {
  ctaKey: "imobiliarias-corretores",
  hero: {
    eyebrow: "ComoFica.ai para imobiliárias e corretores",
    title: "Mostre o potencial do imóvel durante a visita - não dias depois.",
    subheadline:
      "Ajude o comprador a visualizar mobiliário, reforma, estilo e novos usos em uma experiência que funciona no tablet do corretor, no site e no WhatsApp da imobiliária.",
    secondaryCtaLabel: "Ver casos de uso",
    secondaryCtaHref: "#aplicacoes",
    microcopy: "Use uma foto real e autorizada de um imóvel que sua equipe atende.",
    demoItems: [tinta],
  },
  problem: {
    eyebrow: "O problema",
    title: "Muitas vezes, o cliente rejeita o estado atual - não o potencial do imóvel.",
    text: "Um ambiente vazio, antigo ou diferente do estilo do comprador exige imaginação. Quando o cliente não consegue enxergar mobiliário, reforma ou outra forma de uso, o corretor precisa explicar uma possibilidade que ainda não está visível.",
  },
  proposta: {
    id: "diferenciais",
    eyebrow: "A proposta",
    title: "Transforme a objeção visual em uma demonstração personalizada.",
    text: "Com a ComoFica, o corretor registra ou recebe a foto do ambiente, orienta a alteração e apresenta uma simulação durante o atendimento. A equipe pode revisar o resultado antes de mostrar e compartilhar o antes/depois pelo WhatsApp.",
  },
  flow: {
    id: "fluxo",
    eyebrow: "Operação de equipe",
    title: "Uma experiência comum para a equipe. Uma marca consistente para o cliente.",
    steps: [
      { number: "01", title: "Acesso próprio", description: "Cada usuário pode ter acesso próprio, enquanto a imobiliária acompanha históricos e analytics no painel." },
      { number: "02", title: "Marca da imobiliária", description: "A interface pode destacar a marca da empresa em toda a experiência." },
      { number: "03", title: "Equipe ou cliente", description: "Pode funcionar apenas para corretores, para clientes finais ou para os dois públicos." },
      { number: "04", title: "Histórico e analytics", description: "Consultas de histórico e analytics ficam centralizadas no painel da imobiliária." },
    ],
  },
  useCases: {
    id: "aplicacoes",
    eyebrow: "Casos de uso",
    title: "Do virtual staging à visita assistida.",
    items: [
      { title: "Virtual staging", description: "Mobiliar digitalmente ambientes vazios para ajudar o comprador a entender escala de uso, composição e estilo, sempre identificando a imagem como simulação." },
      { title: "Imóvel antigo", description: "Explorar uma possibilidade de reforma, pintura ou acabamento sem ocultar defeitos ou prometer execução." },
      { title: "Mudança de uso", description: "Mostrar um quarto como escritório, uma varanda como espaço de lazer ou outro cenário coerente com a estrutura existente." },
      { title: "Visita assistida", description: "Gerar uma alternativa no tablet ou smartphone enquanto o cliente está no imóvel e a dúvida está viva." },
      { title: "Anúncio e captação", description: "Criar apresentações mais ricas para portais, redes, proprietários e leads, com autorização e transparência." },
      { title: "WhatsApp", description: "Receber uma foto, explorar alternativas e continuar a conversa com um link de comparação." },
    ],
  },
  channels: {
    eyebrow: "Valor por função",
    title: "Um caso de uso com valor claro em cada área.",
    channels: [
      { title: "Dono ou diretor", description: "Transforme inovação em padrão de atendimento da imobiliária." },
      { title: "Gerente comercial", description: "Dê à equipe um processo visual replicável e acompanhável." },
      { title: "Corretor", description: 'Mostre uma possibilidade quando o cliente disser "não consigo imaginar".' },
    ],
  },
  complementaridade: {
    title: "Valorize o potencial sem distorcer o imóvel.",
    text: "Simulações não devem ocultar defeitos, ampliar espaços de forma enganosa ou alterar características permanentes sem aviso. Identifique imagens geradas por IA, preserve a foto original e deixe claro quando a cena representa uma possibilidade de reforma ou ambientação.",
  },
  valorPorFuncao: {
    eyebrow: "Marketing e captação",
    title: "Também gera valor fora do atendimento direto.",
    items: [
      { title: "Marketing", description: "Crie variações transparentes e organizadas para anúncios e campanhas." },
      { title: "Captação", description: "Enriqueça a apresentação do imóvel para o proprietário e para o mercado." },
    ],
  },
  confiancaLimites: {
    title: "Transparência antes de tudo.",
    text: "A ComoFica não substitui projeto de reforma: a simulação ajuda a explorar e comunicar uma ideia; medidas, projeto, orçamento e execução precisam de profissionais e validações próprios. Não há garantia de resultado comercial — a plataforma cria condições para reduzir dúvida e tornar o potencial mais fácil de compreender.",
  },
  faq: {
    id: "perguntas",
    eyebrow: "Dúvidas comuns",
    title: "Perguntas frequentes",
    items: [
      { question: "Posso usar a simulação em anúncios?", answer: "Pode, desde que haja autorização, identificação clara da natureza ilustrativa e acesso à imagem original quando a peça influenciar uma decisão." },
      { question: "A plataforma serve apenas para imóveis vazios?", answer: "Não. Ela também pode explorar reforma, decoração, pintura, acabamento e mudança de uso em ambientes ocupados ou antigos." },
      { question: "O corretor consegue usar durante a visita?", answer: "Sim. A plataforma é acessível por smartphone, tablet e computador. O ideal é gerar uma alternativa por vez e revisar antes de apresentar." },
      { question: "O cliente pode gerar pelo WhatsApp?", answer: "Pode, se a imobiliária liberar o acesso externo. Também é possível manter o uso apenas com a equipe." },
      { question: "A ComoFica substitui projeto de reforma?", answer: "Não. A simulação ajuda a explorar e comunicar uma ideia; medidas, projeto, orçamento e execução precisam de profissionais e validações próprios." },
      { question: "A ferramenta garante que o imóvel venda mais rápido?", answer: "Não há garantia de resultado comercial. A plataforma cria condições para reduzir dúvida, personalizar o atendimento e tornar o potencial mais fácil de compreender." },
    ],
  },
  ctaFinal: {
    title: "Escolha um imóvel que o cliente tem dificuldade de imaginar.",
    text: "Use uma foto do portfólio e uma objeção real. Em uma demonstração, sua equipe vê como a visualização pode entrar na visita, no site e no WhatsApp.",
  },
}

export const ACABAMENTOS_CONTENT: SolutionPageContent = {
  ctaKey: "acabamentos-revestimentos",
  hero: {
    eyebrow: "ComoFica.ai para acabamentos e revestimentos",
    title: "Faça o cliente ver o produto no próprio ambiente antes de decidir.",
    subheadline:
      "Aplique pisos, porcelanatos, pedras, tintas, revestimentos e outros produtos na foto do ambiente real, usando o catálogo da empresa ou uma simples imagem de referência.",
    secondaryCtaLabel: "Ver como funciona",
    secondaryCtaHref: "#fluxo",
    microcopy: "Comece com um produto estratégico. Não é necessário cadastrar todo o catálogo.",
    demoItems: [porcelanato],
  },
  problem: {
    eyebrow: "O problema",
    title: "A amostra mostra o produto. O cliente ainda precisa imaginar o ambiente inteiro.",
    text: "Cor, brilho, textura, paginação, iluminação e combinação mudam quando o produto sai do mostruário e entra no contexto real. A ComoFica ajuda a transformar essa diferença em uma referência visual durante a conversa.",
  },
  proposta: {
    id: "diferenciais",
    eyebrow: "Aplicações",
    title: "Da referência do produto ao ambiente do cliente.",
    text: "Cada aplicação é uma simulação. Amostras físicas, lote, acabamento, medidas e instalação devem ser confirmados.",
    tags: ["Pisos e porcelanatos", "Revestimentos e azulejos", "Pedras, bancadas e superfícies", "Tintas e papéis de parede", "Painéis e cortinas", "Iluminação e áreas externas"],
  },
  flow: {
    id: "fluxo",
    eyebrow: "Fluxo",
    title: "Da referência do produto ao ambiente do cliente.",
    steps: [
      { number: "01", title: "Foto do ambiente", description: "O cliente envia uma foto do ambiente ou o vendedor registra a imagem." },
      { number: "02", title: "Produto", description: "A equipe escolhe um item do catálogo ou envia a foto do produto." },
      { number: "03", title: "Orientação", description: "Uma orientação simples indica piso, parede, bancada, teto ou área de aplicação." },
      { number: "04", title: "Comparação", description: "A simulação retorna com link de comparação antes/depois." },
    ],
  },
  useCases: {
    id: "aplicacoes",
    eyebrow: "Canais",
    title: "Do balcão da loja ao WhatsApp do cliente.",
    items: [
      { title: "No atendimento presencial", description: "O vendedor gera e revisa a simulação pelo tablet, smartphone ou computador antes de apresentar." },
      { title: "No site", description: "O cliente pode explorar produtos e chegar ao atendimento com opções mais concretas." },
      { title: "No WhatsApp", description: "A foto, o produto e a orientação entram na conversa, e o resultado volta com o comparador." },
    ],
  },
  channels: {
    eyebrow: "Catálogo",
    title: "Catálogo quando ajuda. Foto de referência quando agiliza.",
    channels: [
      { title: "Com catálogo configurado", description: "O produto pode permanecer associado ao SKU e ao preço." },
      { title: "Sem catálogo", description: "A geração funciona com uma imagem de referência do produto." },
      { title: "Por onde começar", description: "A implantação pode começar pelos itens mais vendidos, estratégicos ou que mais geram dúvida." },
    ],
  },
  complementaridade: {
    title: "Catálogo quando ajuda. Amostra física quando decide.",
    text: "Não comunicamos consulta de estoque em tempo real, condições comerciais ou compra automática como funções padrão. A amostra física continua indispensável quando a decisão exige precisão de cor, textura ou lote.",
  },
  valorPorFuncao: {
    eyebrow: "Por que funciona",
    title: "A cor e a textura ficam exatamente iguais?",
    items: [
      { title: "Contexto preservado", description: "A plataforma busca manter características visuais da referência e o contexto da cena." },
      { title: "Variação possível", description: "Tela, iluminação, lote e qualidade da foto podem alterar a percepção final." },
    ],
  },
  confiancaLimites: {
    title: "Visualização não substitui projeto de paginação.",
    text: "A ferramenta ajuda a visualizar uma possibilidade; medição, paginação executiva, cálculo de material e instalação exigem validação profissional.",
  },
  faq: {
    id: "perguntas",
    eyebrow: "Dúvidas comuns",
    title: "Perguntas frequentes",
    items: [
      { question: "Preciso cadastrar todos os produtos?", answer: "Não. A empresa pode começar com uma seleção prioritária e também usar fotos de referência." },
      { question: "A cor e a textura ficam exatamente iguais?", answer: "A plataforma busca manter características visuais da referência e o contexto da cena, mas tela, iluminação, lote e qualidade da foto podem alterar a percepção. A amostra física continua indispensável quando aplicável." },
      { question: "O produto fica associado ao catálogo?", answer: "Sim, quando o catálogo está configurado. A simulação pode permanecer associada a SKU e preço." },
      { question: "A ComoFica consulta estoque?", answer: "Não como função padrão. Uma consulta em tempo real dependeria de integração específica com o sistema do cliente." },
      { question: "O cliente pode usar sem vendedor?", answer: "Pode, se a empresa ativar o uso externo no site ou WhatsApp. O acesso também pode ficar restrito à equipe." },
      { question: "A ferramenta substitui um projeto de paginação?", answer: "Não. Ela ajuda a visualizar uma possibilidade; medição, paginação executiva, cálculo de material e instalação exigem validação profissional." },
    ],
  },
  ctaFinal: {
    title: "Escolha um produto que costuma gerar dúvida. Vamos aplicá-lo em um ambiente real.",
    text: "A demonstração mostra o fluxo com catálogo ou foto de referência, o antes/depois e as possibilidades no painel, no site e no WhatsApp.",
  },
}

export const MOVEIS_CONTENT: SolutionPageContent = {
  ctaKey: "moveis-decoracao",
  hero: {
    eyebrow: "ComoFica.ai para móveis e decoração",
    title: 'Tire o "será que combina?" do caminho da escolha.',
    subheadline:
      "Ajude o cliente a explorar sofás, mesas, armários, iluminação e composições no próprio espaço antes de escolher - com uso pelo atendimento, pelo site ou pelo WhatsApp.",
    secondaryCtaLabel: "Ver aplicações",
    secondaryCtaHref: "#aplicacoes",
    demoItems: [planejados],
  },
  problem: {
    eyebrow: "O problema",
    title: "Dimensão, estilo e composição são difíceis de decidir fora do ambiente.",
    text: "Uma foto de catálogo apresenta o produto. A decisão, porém, acontece quando o cliente tenta relacionar aquele item à sala, ao quarto, à iluminação e ao que já possui. A visualização aproxima produto e contexto sem exigir um processo complexo para cada alternativa preliminar.",
  },
  proposta: {
    id: "diferenciais",
    eyebrow: "Aplicações",
    title: "O produto entra no ambiente antes de entrar no pedido.",
    text: "De móveis soltos a planejados, a visualização ajuda o cliente a decidir dentro do próprio espaço.",
  },
  flow: {
    id: "fluxo",
    eyebrow: "Fluxo",
    title: "O produto entra no ambiente antes de entrar no pedido.",
    steps: [
      { number: "01", title: "Ambiente", description: "Envie a foto do ambiente." },
      { number: "02", title: "Referência", description: "Escolha o item do catálogo ou envie a referência." },
      { number: "03", title: "Composição", description: "Oriente posição, substituição ou composição desejada." },
      { number: "04", title: "Comparação", description: "Compare a possibilidade com o ambiente original e continue o atendimento." },
    ],
  },
  useCases: {
    id: "aplicacoes",
    eyebrow: "Aplicações",
    title: "De móveis soltos a planejados.",
    items: [
      { title: "Móveis soltos", description: "Explore sofás, mesas, cadeiras, estantes, poltronas, tapetes e objetos em uma composição visual do ambiente." },
      { title: "Iluminação", description: "Visualize luminárias, pendentes e arandelas e uma possibilidade de efeito de luz, sempre validando especificação e projeto." },
      { title: "Móveis planejados", description: "Use a simulação como exploração preliminar de acabamento, cor e composição antes de avançar para medição e projeto técnico." },
      { title: "Venda cruzada", description: "Apresente combinações de itens quando o catálogo estiver organizado, sem transformar a simulação em orçamento ou disponibilidade automática." },
    ],
  },
  channels: {
    eyebrow: "Canais",
    title: "A visualização acompanha a jornada da loja ao celular do cliente.",
    channels: [
      { title: "Atendimento", description: "O vendedor revisa alternativas no painel." },
      { title: "Site", description: "O visitante explora produtos em uma experiência com a marca da empresa." },
      { title: "WhatsApp", description: "Cliente e equipe transformam uma dúvida em simulação durante a conversa." },
    ],
  },
  complementaridade: {
    title: "Visualização não substitui medida, encaixe ou projeto.",
    text: "A plataforma busca representar proporção e contexto, mas não garante que um móvel caiba, que uma instalação seja viável ou que a iluminação tenha desempenho idêntico. Medidas, ergonomia, fixação, elétrica, materiais e projeto precisam ser validados.",
  },
  valorPorFuncao: {
    eyebrow: "Por que funciona",
    title: "Serve para móveis planejados?",
    items: [
      { title: "Exploração preliminar", description: "Serve para explorações preliminares de cor, acabamento e composição." },
      { title: "Projeto técnico continua", description: "Projeto técnico, medição, ferragens e execução continuam indispensáveis." },
    ],
  },
  confiancaLimites: {
    title: "A simulação confirma que o móvel cabe?",
    text: "Não. Ela ajuda a explorar proporção e composição visual. Medidas e condições de instalação devem ser verificadas separadamente. Projeto luminotécnico, potência e desempenho de iluminação exigem cálculo e especificação próprios.",
  },
  faq: {
    id: "perguntas",
    eyebrow: "Dúvidas comuns",
    title: "Perguntas frequentes",
    items: [
      { question: "A simulação confirma que o móvel cabe?", answer: "Não. Ela ajuda a explorar proporção e composição visual. Medidas e condições de instalação devem ser verificadas separadamente." },
      { question: "Serve para móveis planejados?", answer: "Serve para explorações preliminares de cor, acabamento e composição. Projeto técnico, medição, ferragens e execução continuam indispensáveis." },
      { question: "Posso usar itens do meu catálogo?", answer: "Sim. Quando configurados, os produtos podem ficar associados a SKU e preço. Também é possível usar uma foto de referência." },
      { question: "A iluminação simulada é exata?", answer: "Não. A ferramenta pode representar uma possibilidade de tonalidade e efeito visual, mas projeto luminotécnico, potência e desempenho exigem cálculo e especificação." },
      { question: "O cliente consegue compartilhar o resultado?", answer: "Sim. O link de comparação mostra antes/depois em slider e lado a lado." },
    ],
  },
  ctaFinal: {
    title: "Traga um ambiente e um produto. Veja a conversa mudar de forma.",
    text: "Em uma demonstração contextual, você conhece o fluxo, o comparador e as formas de levar a experiência ao atendimento, ao site e ao WhatsApp.",
  },
}
