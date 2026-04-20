"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, Loader2, MessageSquare, Package, RefreshCw, Users, Zap } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"

type AnalyticsPayload = {
  stats: {
    conversations: number
    contacts: number
    catalogItems: number
    compositions: number
    completedCompositions: number
    failedCompositions: number
    unreadMessages: number
    connectedChannels: number
    aiHandledConversations: number
    operatorHandledConversations: number
    messages: number
  }
  conversationData: Array<{ name: string; conversas: number; composicoes: number; contatos: number }>
  hourlyData: Array<{ hour: string; mensagens: number; ia: number; operador: number }>
  compositionModeData: Array<{ name: string; value: number; color: string }>
  jobStatusData: Array<{ name: string; value: number; color: string }>
}

type TenantAnalyticsViewProps = {
  tenantSlug: string
  compact?: boolean
}

async function requestJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisicao invalida."
    throw new Error(message)
  }

  return payload as T
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: number
  helper: string
  icon: typeof BarChart3
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-3 font-display text-3xl font-bold text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function TenantAnalyticsView({ tenantSlug, compact = false }: TenantAnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadAnalytics() {
    setIsLoading(true)
    setError(null)

    try {
      const payload = await requestJson<AnalyticsPayload>(`/api/tenant/${tenantSlug}/analytics`)
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar analytics.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
  }, [tenantSlug])

  const hasTimelineData = useMemo(() =>
    Boolean(data?.conversationData.some((item) => item.conversas > 0 || item.composicoes > 0 || item.contatos > 0)),
  [data])
  const hasHourlyData = useMemo(() =>
    Boolean(data?.hourlyData.some((item) => item.mensagens > 0 || item.ia > 0 || item.operador > 0)),
  [data])
  const hasCompositionModes = useMemo(() =>
    Boolean(data?.compositionModeData.some((item) => item.value > 0)),
  [data])

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Tenant</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              {compact ? "Dashboard" : "Analytics"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dados calculados a partir de inbox, contatos, catálogo, composições e canais reais.
            </p>
          </div>
          <Button variant="outline" onClick={loadAnalytics} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 px-6 py-3 text-sm font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading || !data ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando analytics...
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Conversas" value={data.stats.conversations} helper={`${data.stats.unreadMessages} novas mensagens`} icon={MessageSquare} />
              <StatCard label="Contatos" value={data.stats.contacts} helper="Manual + inbox" icon={Users} />
              <StatCard label="Catálogo" value={data.stats.catalogItems} helper="Produtos cadastrados" icon={Package} />
              <StatCard label="Composições" value={data.stats.compositions} helper={`${data.stats.completedCompositions} concluídas, ${data.stats.failedCompositions} falhas`} icon={Zap} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-foreground">Movimento dos últimos 7 dias</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Conversas, composições e contatos reais criados por dia.</p>
                </div>
                <div className="h-[320px]">
                  {hasTimelineData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.conversationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Line type="monotone" dataKey="conversas" stroke="#31c48d" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="composicoes" stroke="#60a5fa" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="contatos" stroke="#f59e0b" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Ainda não há movimento real nos últimos 7 dias." />
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-foreground">Modos de composição</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Distribuição dos jobs reais.</p>
                </div>
                <div className="h-[320px]">
                  {hasCompositionModes ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.compositionModeData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={110} paddingAngle={4}>
                          {data.compositionModeData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Ainda não há composições reais para distribuir." />
                  )}
                </div>
              </section>
            </div>

            {!compact && (
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-5">
                  <h2 className="font-display text-lg font-bold text-foreground">Mensagens por horário</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Mensagens reais do inbox por hora, separando IA e operador.</p>
                </div>
                <div className="h-[320px]">
                  {hasHourlyData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} interval={2} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="ia" stackId="a" fill="#31c48d" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="operador" stackId="a" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="Ainda não há mensagens reais para este gráfico." />
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
