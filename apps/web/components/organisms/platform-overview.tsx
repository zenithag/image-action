import { BarChart3, Bot, Building2, ImagePlus, MessageSquareText, ShieldCheck } from "lucide-react"

import { ModuleCard } from "@/components/molecules/module-card"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const modules = [
  {
    icon: Building2,
    title: "Superadmin",
    summary: "Provisiona tenants manualmente, controla dominios, planos, sessoes e saude da operacao.",
    tag: "Governanca",
  },
  {
    icon: MessageSquareText,
    title: "Channel Gateway",
    summary: "Recebe eventos do WhatsApp, normaliza midia e roteia cada conversa para o tenant correto.",
    tag: "Entrada",
  },
  {
    icon: Bot,
    title: "Orchestrator",
    summary: "Usa OpenRouter com structured outputs para classificar intencao e chamar tools internas.",
    tag: "LLM",
  },
  {
    icon: ImagePlus,
    title: "Composition Engine",
    summary: "Executa pipelines de interiores, produto, estampa e vestuario com revisao quando necessario.",
    tag: "Render",
  },
  {
    icon: ShieldCheck,
    title: "Tenant Console",
    summary: "Entrega inbox, aprovacao humana, catalogo e configuracao operacional por tenant.",
    tag: "Operacao",
  },
  {
    icon: BarChart3,
    title: "Billing & Metering",
    summary: "Mede mensagens, tokens, jobs, custo e latencia para aplicar limites e gerar relatorios.",
    tag: "Analytics",
  },
]

const metrics = [
  { label: "Tempo ate primeira simulacao", value: "< 3 min", hint: "Meta operacional para interior e produto." },
  { label: "Escopo de canais no MVP", value: "WhatsApp", hint: "Instagram entra na fase seguinte." },
  { label: "Unidade de isolamento", value: "Tenant", hint: "Dados, prompts, limites e dominios separados." },
]

export function PlatformOverview() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(140deg,rgba(255,250,245,0.96),rgba(255,241,232,0.82))]">
          <CardContent className="space-y-8 p-8 md:p-10">
            <SectionHeading
              eyebrow="Conversational imaging"
              title="A interface publica e o chat. O frontend e o centro operacional."
              description="A plataforma existe para transformar pedidos de WhatsApp em composicoes visuais rastreaveis, multi-tenant e com controle de custo. O console serve operadores e admins, nao o cliente final."
            />
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Priorizar onboarding de tenant</Button>
              <Button variant="outline" size="lg">Mapear webhook e state machine</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <Separator className="bg-primary/15" />

      <section className="space-y-6">
        <SectionHeading
          eyebrow="Atomic frontend"
          title="Shadcn primitives abaixo, modulos operacionais acima."
          description="A base visual usa primitives shadcn em components/ui. Sobre essa camada, atoms, molecules e organisms montam telas operacionais sem misturar semantica de negocio com detalhes de estilo."
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard key={module.title} {...module} />
          ))}
        </div>
      </section>
    </div>
  )
}
