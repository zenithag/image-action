import type { Tenant } from "@studio/contracts"
import { ActivityRow } from "@/components/molecules/activity-row"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SuperadminDashboardProps = {
  tenants: Tenant[]
}

const pipelineMetrics = [
  { label: "Tenants ativos", value: "12", hint: "4 aguardando ativacao de dominio e canal." },
  { label: "Custo LLM hoje", value: "R$ 184", hint: "OpenRouter agregado em todos os tenants." },
  { label: "Jobs em revisao", value: "27", hint: "Fashion e product concentram a maior parte." },
]

export function SuperadminDashboard({ tenants }: SuperadminDashboardProps) {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-primary/15 bg-[linear-gradient(155deg,rgba(255,250,245,0.98),rgba(255,241,232,0.84))]">
          <CardContent className="space-y-8 p-8 md:p-10">
            <SectionHeading
              eyebrow="Superadmin"
              title="Provisionamento manual, governanca global e observabilidade por tenant."
              description="O backoffice central acompanha dominios, sessoes UAZAPI/WUZAPI, custo de LLM, filas de revisao e saude operacional. Tenant nasce aqui e so depois vai para operacao."
            />
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Criar tenant</Button>
              <Button variant="outline" size="lg">Conferir sessoes desconectadas</Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {pipelineMetrics.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Tenants em operacao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenants.map((tenant) => (
              <ActivityRow
                key={tenant.id}
                title={tenant.name}
                detail={`slug: ${tenant.slug} · plano: ${tenant.plan_code}`}
                status={tenant.status}
                tone={tenant.status === "active" ? "default" : "secondary"}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">Fila critica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActivityRow
              title="Dominio aguardando DNS"
              detail="casa-atelie.example.com ainda nao validou CNAME."
              status="pending"
            />
            <ActivityRow
              title="Sessao WhatsApp desconectada"
              detail="tenant moda-urbana precisa religar a sessao principal."
              status="error"
              tone="secondary"
            />
            <ActivityRow
              title="Tenant proximo do limite"
              detail="decor-labs atingiu 92% da cota diaria de jobs."
              status="alerta"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
