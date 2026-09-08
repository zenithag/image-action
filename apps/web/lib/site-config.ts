// Fonte única de navegação, sitemap e CTAs do site institucional público da
// ComoFica.ai — usada por SiteHeader, SiteFooter, app/sitemap.ts e cada page.tsx,
// pra não repetir a mesma lista de rotas em vários lugares (regra do Guia de
// Estratégia, cap. 19.7: "não deixar mensagens de WhatsApp espalhadas em vários
// componentes; centralizar configuração").
//
// Número de WhatsApp: mantido igual ao que já está em produção hoje
// (landing-page.tsx). O próprio guia marca esse número como "CONFIRMAR antes
// de publicar" (cap. 4.5) — não foi alterado nem inventado, só centralizado.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comofica.ai"
export const SITE_NAME = "ComoFica.ai"
export const WHATSAPP_NUMBER = "5547992662170"

export function buildWhatsAppLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export type SolutionSlug =
  | "construtoras-incorporadoras"
  | "imobiliarias-corretores"
  | "acabamentos-revestimentos"
  | "moveis-decoracao"
  | "moda-provador-virtual"

export interface SolutionNavItem {
  slug: SolutionSlug
  href: `/solucoes/${SolutionSlug}`
  label: string
  shortLabel: string
  description: string
  /** Rótulo do guia (cap. 4.2) — só a página de moda leva selo hoje. */
  badge?: string
}

// Ordem oficial dos ICPs (Guia, cap. 1.6 e briefing.md do ComoFica.ai):
// construtoras > imobiliárias > acabamentos > móveis > moda (futuro).
export const SOLUTIONS: SolutionNavItem[] = [
  {
    slug: "construtoras-incorporadoras",
    href: "/solucoes/construtoras-incorporadoras",
    label: "Construtoras e incorporadoras",
    shortLabel: "Construtoras",
    description: "Ajude o comprador a visualizar acabamentos e o empreendimento antes da entrega.",
  },
  {
    slug: "imobiliarias-corretores",
    href: "/solucoes/imobiliarias-corretores",
    label: "Imobiliárias e corretores",
    shortLabel: "Imobiliárias",
    description: "Mostre o potencial do imóvel durante a visita, no anúncio ou no WhatsApp.",
  },
  {
    slug: "acabamentos-revestimentos",
    href: "/solucoes/acabamentos-revestimentos",
    label: "Acabamentos e revestimentos",
    shortLabel: "Acabamentos",
    description: "Aplique pisos, pedras, tintas e revestimentos no ambiente real do cliente.",
  },
  {
    slug: "moveis-decoracao",
    href: "/solucoes/moveis-decoracao",
    label: "Móveis e decoração",
    shortLabel: "Móveis",
    description: "Ajude o cliente a explorar móveis, iluminação e composições no próprio espaço.",
  },
  {
    slug: "moda-provador-virtual",
    href: "/solucoes/moda-provador-virtual",
    label: "Moda e provador virtual",
    shortLabel: "Moda",
    description: "Projetos de visualização para peças e combinações, sob avaliação caso a caso.",
    badge: "Aplicação futura",
  },
]

export interface NavLink {
  label: string
  href: string
}

// Navegação principal do header (cap. 4.2 do guia). "Soluções" abre o dropdown
// com o array SOLUTIONS acima.
export const PRIMARY_NAV: NavLink[] = [
  { label: "Plataforma", href: "/plataforma" },
  { label: "Como funciona", href: "/plataforma#como-funciona" },
  { label: "Conteúdos", href: "/conteudos" },
  { label: "Perguntas frequentes", href: "/perguntas-frequentes" },
]

// Rodapé (cap. 4.4 do guia).
export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "Soluções",
    links: SOLUTIONS.map((s) => ({ label: s.label, href: s.href })),
  },
  {
    title: "Plataforma",
    links: [
      { label: "Como funciona", href: "/plataforma#como-funciona" },
      { label: "Formas de usar", href: "/plataforma#canais" },
      { label: "Catálogo e equipe", href: "/plataforma#catalogo" },
      { label: "Perguntas frequentes", href: "/perguntas-frequentes" },
      { label: "Entrar", href: "/login" },
    ],
  },
  {
    title: "Empresa e legal",
    links: [
      { label: "Contato", href: "/contato" },
      { label: "Conteúdos", href: "/conteudos" },
      { label: "Política de privacidade", href: "/privacidade" },
      { label: "Termos de uso", href: "/termos" },
    ],
  },
]

// Mensagens de WhatsApp por página (Guia, cap. 4.5) — texto exato da
// especificação, não inventado.
export const CTA_MESSAGES = {
  home: {
    label: "Agendar uma demonstração",
    message: "Olá! Conheci a ComoFica.ai pelo site e gostaria de agendar uma demonstração.",
  },
  plataforma: {
    label: "Ver a plataforma em ação",
    message: "Olá! Gostaria de conhecer a plataforma, o uso no site e a integração ao WhatsApp.",
  },
  "construtoras-incorporadoras": {
    label: "Ver em um empreendimento",
    message: "Olá! Gostaria de ver a ComoFica.ai aplicada a um empreendimento da nossa empresa.",
  },
  "imobiliarias-corretores": {
    label: "Simular um imóvel do portfólio",
    message: "Olá! Gostaria de fazer uma demonstração com um imóvel do nosso portfólio.",
  },
  "acabamentos-revestimentos": {
    label: "Aplicar um produto da minha loja",
    message: "Olá! Gostaria de testar um produto da nossa loja em um ambiente real.",
  },
  "moveis-decoracao": {
    label: "Testar com um ambiente real",
    message: "Olá! Gostaria de testar móveis ou decoração em um ambiente real.",
  },
  "moda-provador-virtual": {
    label: "Conversar sobre um projeto",
    message: "Olá! Gostaria de conversar sobre uma possível aplicação da ComoFica.ai em moda ou provador virtual.",
  },
} as const

export type CtaPageKey = keyof typeof CTA_MESSAGES

// Rotas que já existem de fato no app (usadas por app/sitemap.ts e
// app/robots.ts). Cresce a cada etapa do plano.
//
// Deliberadamente fora desta lista, embora as rotas existam e sejam
// navegáveis (menu/rodapé): `/privacidade` e `/termos` (placeholder sem texto
// jurídico real — Guia 4.1: "publicar somente após aprovação jurídica e
// técnica") e `/solucoes/moda-provador-virtual` (Guia 20.7: "após decisão
// explícita sobre indexação e oferta"). As três levam `robots: { index: false }`
// na própria rota — não faz sentido pedir a um buscador pra indexar o que a
// gente pediu pra ele não indexar. Mover pra cá quando o texto jurídico for
// aprovado / o John decidir publicar moda com indexação.
export const LIVE_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/plataforma", priority: 1, changeFrequency: "weekly" },
  { path: "/solucoes/construtoras-incorporadoras", priority: 1, changeFrequency: "weekly" },
  { path: "/solucoes/imobiliarias-corretores", priority: 1, changeFrequency: "weekly" },
  { path: "/solucoes/acabamentos-revestimentos", priority: 1, changeFrequency: "weekly" },
  { path: "/solucoes/moveis-decoracao", priority: 1, changeFrequency: "weekly" },
  { path: "/perguntas-frequentes", priority: 0.8, changeFrequency: "monthly" },
  { path: "/contato", priority: 0.8, changeFrequency: "monthly" },
  { path: "/login", priority: 0.2, changeFrequency: "yearly" },
]
