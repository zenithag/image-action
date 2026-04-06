import type { ClassificationResponse, Conversation, Message, Tenant } from "@studio/contracts"
import { ActivityRow } from "@/components/molecules/activity-row"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type TenantDashboardProps = {
  tenant: Tenant
  conversation: Conversation
  latestMessage: Message
  classification: ClassificationResponse
}

export function TenantDashboard({
  tenant,
  conversation,
  latestMessage,
  classification,
}: TenantDashboardProps) {
  const metrics = [
    { label: "Conversas abertas", value: "38", hint: "8 aguardando imagem base." },
    { label: "Tempo medio p/ render", value: "2m 14s", hint: "Interior e product em destaque." },
    { label: "Taxa de revisao", value: "31%", hint: "Product e fashion puxam a fila." },
  ]

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-primary/15 bg-[linear-gradient(155deg,rgba(255,249,243,0.98),rgba(248,238,228,0.86))]">
          <CardContent className="space-y-8 p-8 md:p-10">
            <SectionHeading
              eyebrow={`Tenant ${tenant.slug}`}
              title="Inbox operacional, catalogo e render assistido em um unico console."
              description="O console do tenant conecta atendimento, jobs e revisao humana. A equipe acompanha a conversa, o classificador e o status do pipeline sem sair do contexto comercial."
            />
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Abrir inbox</Button>
              <Button variant="outline" size="lg">Ajustar prompts-base</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Conversa selecionada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActivityRow
              title={`Conversa ${conversation.id.slice(0, 8)}`}
              detail={`status: ${conversation.status} · contato: ${latestMessage.role}`}
              status={classification.next_action}
              tone="default"
            />
            <ActivityRow
              title="Ultima mensagem"
              detail={latestMessage.content}
              status={classification.intent}
            />
            <ActivityRow
              title="Classificacao atual"
              detail={`modo: ${classification.mode ?? "indefinido"} · confianca: ${(classification.confidence * 100).toFixed(0)}%`}
              status={classification.source}
              tone="secondary"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Proximo passo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActivityRow
              title="Acao sugerida"
              detail={classification.rationale}
              status={classification.next_action}
              tone="default"
            />
            {classification.missing_inputs.map((missingInput) => (
              <ActivityRow
                key={missingInput}
                title="Entrada faltante"
                detail={`Solicitar ${missingInput} antes de montar o job.`}
                status="required"
              />
            ))}
            {classification.needs_human_review ? (
              <ActivityRow
                title="Revisao humana"
                detail="Esse modo deve entrar na fila de aprovacao antes do envio automatico."
                status="enabled"
                tone="secondary"
              />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
