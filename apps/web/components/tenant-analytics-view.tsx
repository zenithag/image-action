"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowDown, ArrowUp, BarChart3, Bot, Loader2, MessageSquare, RefreshCw, Users, Zap } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"

type AnalyticsPayload = {
  meta: {
    range: "7d" | "30d" | "month" | "custom"
    label: string
  }
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
    completionRate: number
  }
  deltas: {
    conversations: number
    contacts: number
    compositions: number
    messages: number
    completionRate: number
  }
  responseTimes: {
    aiSeconds: number | null
    operatorSeconds: number | null
    aiLabel: string | null
    operatorLabel: string | null
    aiFastRate: number | null
    operatorFastRate: number | null
  }
  recentConversations: Array<{
    id: string
    contactName: string
    channelInstanceName: string
    handledBy: "ai" | "operator"
    status: "open" | "waiting_customer" | "waiting_operator" | "closed"
    unreadCount: number
    lastMessage: string
    lastMessageAt: string
  }>
  reviewQueue: Array<{
    id: string
    contactName: string
    status: "queued" | "processing" | "done" | "failed"
    prompt: string
    catalogItemName?: string
    createdAt: string
    updatedAt: string
  }>
  conversationData: Array<{ name: string; conversas: number; composicoes: number; contatos: number }>
  hourlyData: Array<{ hour: string; mensagens: number; ia: number; operador: number }>
  compositionModeData: Array<{ name: string; value: number; color: string }>
  jobStatusData: Array<{ name: string; value: number; color: string }>
}

type TenantAnalyticsViewProps = {
  tenantSlug: string
  compact?: boolean
}

type DateRange = AnalyticsPayload["meta"]["range"]

async function requestJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisição inválida."
    throw new Error(message)
  }

  return payload as T
}

function formatDelta(delta: number | null | undefined) {
  if (delta == null) return null
  return {
    up: delta >= 0,
    value: Math.abs(delta),
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatStatusLabel(value: AnalyticsPayload["recentConversations"][number]["status"] | AnalyticsPayload["reviewQueue"][number]["status"]) {
  if (value === "waiting_customer") return "aguardando cliente"
  if (value === "waiting_operator") return "aguardando operador"
  if (value === "processing") return "processando"
  if (value === "queued") return "na fila"
  if (value === "failed") return "falhou"
  if (value === "done") return "concluída"
  if (value === "closed") return "fechada"
  return "aberta"
}

function StatCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string
  value: number | string
  delta?: number | null
  icon: typeof BarChart3
}) {
  const formattedDelta = formatDelta(delta)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-[18px] flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        {formattedDelta && (
          <span className={`flex items-center gap-1 text-xs ${formattedDelta.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formattedDelta.up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {formattedDelta.value}%
          </span>
        )}
      </div>
      <p className="font-mono text-[36px] font-medium leading-none tracking-[-0.03em] text-foreground">{value}</p>
      <p className="mt-1 text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
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

function DashboardEditorial({ data }: { data: AnalyticsPayload }) {
  const hasTimelineData = data.conversationData.some((item) => item.conversas > 0 || item.composicoes > 0 || item.contatos > 0)
  const conversationDelta = formatDelta(data.deltas.conversations)

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] items-start gap-10 border-b border-border pb-6 pt-3">
        <div>
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{data.meta.label}</p>
          <p className="mt-2.5 font-display text-[96px] font-medium leading-[0.95] tracking-[-0.04em] text-foreground">
            {data.stats.conversations}
            <span className="text-muted-foreground/40">/</span>
            <span className="text-[48px] text-muted-foreground">{data.stats.messages}</span>
          </p>
          <p className="mt-3 max-w-[420px] text-[14px] leading-relaxed text-muted-foreground">
            Conversas no período{" "}
            {conversationDelta ? (
              <span className={conversationDelta.up ? "text-primary" : "text-red-600 dark:text-red-400"}>
                {conversationDelta.up ? "↑" : "↓"}
                {conversationDelta.value}%
              </span>
            ) : (
              <span className="text-muted-foreground">sem comparação</span>
            )}{" "}
            em relação ao período anterior. {data.stats.compositions} composições geradas, com {data.stats.completionRate}% concluídas.
          </p>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Composições</p>
          <p className="mt-2.5 font-display text-[56px] font-medium leading-none text-foreground">
            {data.stats.compositions}
            <span className="text-[24px] text-muted-foreground"> jobs</span>
          </p>
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            → {data.stats.completedCompositions} concluídas · {data.stats.failedCompositions} falharam
          </p>
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Custo do mês</p>
          <p className="mt-2.5 font-mono text-[40px] font-semibold leading-none text-foreground">n/d</p>
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            → Custos ainda não estão conectados a um provider financeiro real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 items-start gap-6">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold text-foreground">Volume por dia</h3>
            <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{data.meta.label}</span>
          </div>
          <div className="rounded-xl border border-border bg-secondary/50 p-5">
            <div className="h-[260px] min-w-0">
              {hasTimelineData ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={data.conversationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip />
                    <Line type="monotone" dataKey="conversas" stroke="#31c48d" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="composicoes" stroke="#60a5fa" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label={`Ainda não há movimento real em ${data.meta.label.toLowerCase()}.`} />
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[15px] font-semibold text-foreground">Fila de revisão</h3>
            <span className="text-[13px] font-medium text-muted-foreground">{data.reviewQueue.length} itens</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {data.reviewQueue.length > 0 ? (
              data.reviewQueue.map((job) => (
                <div key={job.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{job.contactName}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{job.catalogItemName || job.prompt}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      {formatStatusLabel(job.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Atualizado em {formatDateTime(job.updatedAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                Nenhuma composição pendente de revisão agora.
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3.5 font-display text-[15px] font-semibold text-foreground">Últimas conversas</h3>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {data.recentConversations.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recentConversations.map((conversation) => (
                <div key={conversation.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{conversation.contactName}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{conversation.lastMessage}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {conversation.channelInstanceName} · {formatDateTime(conversation.lastMessageAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {conversation.unreadCount > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                        {conversation.unreadCount} nova{conversation.unreadCount === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                      {conversation.handledBy === "ai" ? "IA" : "Operador"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma conversa registrada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TenantAnalyticsView({ tenantSlug, compact = false }: TenantAnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [variant, setVariant] = useState<"classic" | "editorial">("classic")
  const [dateRange, setDateRange] = useState<DateRange>("7d")
  const [customStart, setCustomStart] = useState(() => new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().slice(0, 10))

  async function loadAnalytics(range = dateRange) {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ range })
      if (range === "custom") {
        params.set("start", customStart)
        params.set("end", customEnd)
      }
      const payload = await requestJson<AnalyticsPayload>(`/api/tenant/${tenantSlug}/analytics?${params.toString()}`)
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar analytics.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics(dateRange)
  }, [tenantSlug, dateRange, customStart, customEnd])

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
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background px-7">
        <div className="flex flex-col">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {compact ? tenantSlug : "Tenant"}
          </p>
          <h1 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">
            {compact ? "Visão geral" : "Analytics"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as DateRange)}
            className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Este mês</option>
            <option value="custom">Personalizado</option>
          </select>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                aria-label="Data inicial"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="h-9 rounded-[10px] border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                aria-label="Data final"
              />
            </div>
          )}
          <div className="flex items-center gap-0.5 rounded-[10px] bg-muted p-[3px]">
            {([["classic", "Clássica"], ["editorial", "Editorial"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setVariant(key)}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                  variant === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => loadAnalytics(dateRange)} disabled={isLoading}>
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

      <div className="min-h-0 flex-1 overflow-auto px-10 py-8">
        {isLoading || !data ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando analytics...
          </div>
        ) : variant === "editorial" ? (
          <DashboardEditorial data={data} />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label={`Conversas ${data.meta.label.toLowerCase()}`} value={data.stats.conversations} delta={data.deltas.conversations} icon={MessageSquare} />
              <StatCard label="Composições" value={data.stats.compositions} delta={data.deltas.compositions} icon={Zap} />
              <StatCard label="Novos contatos" value={data.stats.contacts} delta={data.deltas.contacts} icon={Users} />
              <StatCard label="Conclusão" value={data.stats.compositions > 0 ? `${data.stats.completionRate}%` : "—"} delta={data.deltas.completionRate} icon={BarChart3} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h4 className="font-display text-[15px] font-semibold text-foreground">Atividade do período</h4>
                    <p className="text-xs text-muted-foreground">{data.meta.label}</p>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-primary" />Conversas</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />Composições</span>
                  </div>
                </div>
                <div className="h-[320px] min-w-0">
                  {hasTimelineData ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                    <EmptyChart label={`Ainda não há movimento real em ${data.meta.label.toLowerCase()}.`} />
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h4 className="font-display text-[15px] font-semibold text-foreground">Composições por modo</h4>
                  <p className="text-xs text-muted-foreground">Distribuição do período</p>
                </div>
                <div className="h-[320px] min-w-0">
                  {hasCompositionModes ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
              <div className="grid gap-6 xl:grid-cols-2">
                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-3">
                    <h4 className="font-display text-[15px] font-semibold text-foreground">Atendimentos por hora</h4>
                    <p className="text-xs text-muted-foreground">IA vs operador humano</p>
                  </div>
                  <div className="h-[320px] min-w-0">
                    {hasHourlyData ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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

                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-4">
                    <h4 className="font-display text-[15px] font-semibold text-foreground">Tempos de resposta</h4>
                    <p className="text-xs text-muted-foreground">Média até a primeira resposta registrada</p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      {
                        icon: Bot,
                        label: "Assistente IA",
                        value: data.responseTimes.aiLabel ?? "n/d",
                        pct: data.responseTimes.aiFastRate ?? 0,
                        note: data.responseTimes.aiFastRate != null
                          ? `${data.responseTimes.aiFastRate}% em até 5s`
                          : "Ainda sem respostas da IA para calcular média",
                      },
                      {
                        icon: Users,
                        label: "Operador",
                        value: data.responseTimes.operatorLabel ?? "n/d",
                        pct: data.responseTimes.operatorFastRate ?? 0,
                        note: data.responseTimes.operatorFastRate != null
                          ? `${data.responseTimes.operatorFastRate}% em até 10min`
                          : "Ainda sem respostas de operador para calcular média",
                      },
                    ].map((response) => {
                      const ResponseIcon = response.icon
                      return (
                        <div key={response.label} className="rounded-xl border border-border bg-secondary p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                              <ResponseIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{response.label}</p>
                              <p className="font-display text-[28px] font-semibold leading-none text-foreground">{response.value}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-[5px] overflow-hidden rounded-full bg-border">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${response.pct}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">{response.note}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
