import type { FaqItem } from "@/components/site/faq-accordion"

export interface FaqGroup {
  title: string
  items: FaqItem[]
}

// FAQ central (Guia, cap. 13.1/13.2) — organizada nos 5 grupos que o guia define.
export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "O que é e como funciona",
    items: [
      {
        question: "O que é a ComoFica.ai?",
        answer:
          "É uma plataforma de visualização comercial com inteligência artificial que ajuda você, sua equipe e seus clientes a ver como produtos, acabamentos e ideias podem ficar em ambientes antes da decisão.",
      },
      {
        question: "Como uma simulação é criada?",
        answer:
          "O usuário envia a imagem do ambiente, escolhe um produto do catálogo ou envia uma foto de referência e dá uma orientação simples sobre o que deseja aplicar, substituir ou visualizar.",
      },
      {
        question: "É preciso escrever prompts complexos?",
        answer: "Não. A experiência foi configurada para pedir apenas as informações essenciais para a aplicação.",
      },
      {
        question: "Quanto tempo leva?",
        answer: "Normalmente, cerca de 10 a 20 segundos. Em alguns casos, uma geração pode levar até um minuto.",
      },
    ],
  },
  {
    title: "Canais, usuários e marca",
    items: [
      {
        question: "Onde a ComoFica funciona?",
        answer: "Na plataforma própria, integrada ao seu site e no WhatsApp da sua empresa.",
      },
      {
        question: "Quem pode usar?",
        answer: "A empresa pode restringir o acesso à equipe, liberar para clientes finais ou adotar um modelo híbrido.",
      },
      {
        question: "A experiência pode ter a marca da minha empresa?",
        answer:
          "Sim. A ComoFica pode operar em white label e destacar a identidade da sua empresa para usuários internos e externos, conforme o projeto.",
      },
      {
        question: "Cada vendedor pode ter um acesso?",
        answer: "Sim. A plataforma admite múltiplos usuários dentro da sua empresa. Quantidades e regras exatas dependem do plano vigente.",
      },
      {
        question: "O histórico fica salvo?",
        answer:
          "A empresa pode consultar o histórico de conversas e imagens dentro do painel. O usuário externo visualiza o próprio histórico no canal em que interagiu.",
      },
      {
        question: "Existe painel de analytics?",
        answer:
          "Sim. O painel permite acompanhar a utilização da ferramenta. Os indicadores disponibilizados devem ser apresentados na demonstração e no escopo vigente.",
      },
    ],
  },
  {
    title: "Catálogo, integrações e operação",
    items: [
      {
        question: "Preciso ter catálogo?",
        answer: "Não. A geração também funciona com uma foto de referência. O catálogo facilita seleção, associação a produto, SKU e preço.",
      },
      {
        question: "Quem atualiza o catálogo?",
        answer: "O cliente pode administrar os produtos. A ComoFica pode realizar a carga inicial e oferecer suporte contínuo sob acordo comercial.",
      },
      {
        question: "A plataforma consulta estoque em tempo real?",
        answer: "Não como função padrão. Uma consulta em tempo real exige integração específica com o sistema do cliente.",
      },
      {
        question: "Existem integrações com ERP, CRM ou e-commerce?",
        answer: "Elas podem ser desenvolvidas sob demanda. Cada integração depende de API, autenticação, dados, segurança, suporte e escopo comercial.",
      },
    ],
  },
  {
    title: "Qualidade, limites e profissionais",
    items: [
      {
        question: "A simulação é igual ao resultado físico?",
        answer:
          "Não deve ser tratada como garantia. A configuração busca preservar o contexto e representar a possibilidade com realismo, mas a imagem pode variar e precisa de validação quando houver decisão material.",
      },
      {
        question: "A ComoFica substitui arquiteto, designer, projetista ou engenheiro?",
        answer:
          "Não. Ela acelera exploração e comunicação. Projeto, medição, especificação e responsabilidade técnica permanecem com profissionais habilitados.",
      },
      {
        question: "Qual a diferença para uma IA genérica?",
        answer:
          "Uma IA genérica atende diversas tarefas. A ComoFica organiza uma operação de visualização com fluxo intuitivo, a marca da sua empresa, catálogo, equipe, histórico, analytics, site, WhatsApp e antes/depois.",
      },
      {
        question: "Qual tecnologia de IA é utilizada?",
        answer: "A ComoFica administra internamente fornecedores e modelos para buscar qualidade e continuidade. O usuário não precisa escolher a tecnologia de base.",
      },
    ],
  },
  {
    title: "Privacidade, contratação e suporte",
    items: [
      {
        question: "As imagens são usadas para treinar modelos?",
        answer:
          "A diretriz da ComoFica é não usar imagens e informações dos clientes para treinamento. Essa garantia deve estar refletida na política, no contrato e nos acordos com fornecedores vigentes.",
      },
      {
        question: "Por quanto tempo os dados ficam armazenados?",
        answer: "O período deve constar da política e do contrato vigentes.",
      },
      {
        question: "Quanto custa?",
        answer:
          "O investimento considera implantação, canais, volume de gerações, usuários, catálogo e serviços adicionais. A proposta é preparada após a demonstração e o entendimento do caso de uso.",
      },
      {
        question: "O que acontece quando o pacote de gerações termina?",
        answer:
          "A empresa pode contratar um pacote adicional sazonal ou avaliar upgrade de plano quando o consumo maior se tornar recorrente, conforme a tabela comercial vigente.",
      },
    ],
  },
]
