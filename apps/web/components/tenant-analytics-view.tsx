"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowDown, ArrowUp, BarChart3, Bot, Loader2, MessageSquare, RefreshCw, Users, Zap } from "lucide-react"
import { Cell } from "recharts"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { TenantOverview } from "@/components/tenant-overview"
import overviewStyles from "./tenant-overview.module.css"

const LineChart = dynamic(
  () => import("recharts").then((m) => m.LineChart),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
)
const PieChart = dynamic(
  () => import("recharts").then((m) => m.PieChart),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
)
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
)
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> }
)
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
)
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
)
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
)
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
)
const Line = dynamic(
  () => import("recharts").then((m) => m.Line),
  { ssr: false }
)
const Pie = dynamic(
  () => import("recharts").then((m) => m.Pie),
  { ssr: false }
)
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
)

export type AnalyticsPayload = {
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

const chartAxisColor = "var(--muted-foreground)"
const chartGridColor = "var(--border)"

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
    <div className="border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {formattedDelta && (
          <span className={`font-mono text-[10px] ${formattedDelta.up ? "text-emerald-500" : "text-red-500"}`}>
            {formattedDelta.up ? "+" : "-"}{formattedDelta.value}%
          </span>
        )}
      </div>
      <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center border border-dashed border-border bg-muted/30 px-6 text-center text-xs text-muted-foreground">
      {label}
    </div>
  )
}

function DashboardEditorial({ data }: { data: AnalyticsPayload }) {
  const hasTimelineData = data.conversationData.some((item) => item.conversas > 0 || item.composicoes > 0 || item.contatos > 0)
  const conversationDelta = formatDelta(data.deltas.conversations)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr_1fr]">
        <section className="border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>fluxo principal</span>
            <span>{data.meta.label}</span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <p className="font-mono text-5xl font-semibold leading-none text-foreground">
              {data.stats.conversations}
            </p>
            <div className="flex flex-col items-end gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">
                {data.stats.messages} msg · {data.stats.compositions} comp
              </span>
              {conversationDelta && (
                <span className={`font-mono text-[10px] ${conversationDelta.up ? "text-emerald-500" : "text-red-500"}`}>
                  {conversationDelta.up ? "+" : "-"}{conversationDelta.value}%
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">pipeline</p>
          <p className="mt-2 font-mono text-4xl font-semibold leading-none text-foreground">
            {data.stats.compositions}
          </p>
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">done</span>
              <span className="font-mono text-foreground">{data.stats.completedCompositions}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">failed</span>
              <span className="font-mono text-foreground">{data.stats.failedCompositions}</span>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">latência IA</p>
          <p className="mt-2 font-mono text-4xl font-semibold leading-none text-foreground">
            {data.responseTimes.aiLabel ?? "n/d"}
          </p>
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">operador</span>
              <span className="font-mono text-foreground">{data.responseTimes.operatorLabel ?? "n/d"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">5s rate</span>
              <span className="font-mono text-foreground">{data.responseTimes.aiFastRate ?? 0}%</span>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">volume por dia</h3>
            <span className="border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{data.meta.label}</span>
          </div>
          <div className="border border-border bg-card p-4">
            <div className="h-[200px] min-w-0">
              {hasTimelineData ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={data.conversationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                    <XAxis dataKey="name" stroke={chartAxisColor} tick={{ fill: chartAxisColor }} fontSize={11} />
                    <YAxis stroke={chartAxisColor} tick={{ fill: chartAxisColor }} fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="conversas" stroke="#31c48d" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="composicoes" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label={`sem dados em ${data.meta.label}`} />
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">fila de revisão</h3>
            <span className="font-mono text-[10px] text-muted-foreground">{data.reviewQueue.length} itens</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.reviewQueue.length > 0 ? (
              data.reviewQueue.map((job) => (
                <div key={job.id} className="border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-foreground">{job.contactName}</p>
                      <p className="mt-0.5 line-clamp-1 font-mono text-[10px] text-muted-foreground">{job.catalogItemName || job.prompt}</p>
                    </div>
                    <span className="shrink-0 border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {formatStatusLabel(job.status)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="border border-dashed border-border bg-muted/30 p-6 text-center font-mono text-[11px] text-muted-foreground">
                nenhuma pendente
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">últimas conversas</h3>
        <div className="border border-border bg-card">
          {data.recentConversations.length > 0 ? (
            <div className="divide-y divide-border">
              {data.recentConversations.map((conversation) => (
                <div key={conversation.id} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-[11px] text-foreground">{conversation.contactName}</p>
                      <span className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {conversation.handledBy === "ai" ? "ia" : "op"}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 font-mono text-[10px] text-muted-foreground">{conversation.lastMessage}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {conversation.unreadCount > 0 && (
                      <span className="border border-primary bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
                        {conversation.unreadCount}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatDateTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center font-mono text-[11px] text-muted-foreground">
              nenhuma conversa registrada
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
  const [variant, setVariant] = useState<"classic" | "editorial">("editorial")
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
    <div className={`flex h-full min-h-0 flex-col bg-background ${compact ? overviewStyles.surface : ""}`}>
      <div className={compact ? overviewStyles.header : "flex h-11 shrink-0 items-center justify-between gap-4 px-8 border-b border-border"}>
        <div className="flex flex-col">
          <h1 className={compact ? undefined : "font-mono text-[13px] font-semibold tracking-tight text-foreground"}>
            {compact ? "Visão geral" : tenantSlug}
          </h1>
          <p className={compact ? undefined : "text-[10px] leading-none text-muted-foreground"}>{compact ? "Acompanhe a operação da sua empresa." : `Analytics · ${data?.meta.label ?? ""}`}</p>
        </div>
        <div className={compact ? overviewStyles.controls : "flex flex-wrap items-center gap-1.5"}>
          <select
            aria-label="Período dos indicadores"
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as DateRange)}
            className="h-8 rounded border border-border bg-background px-2 text-[11px] outline-none focus:border-primary"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Este mês</option>
            <option value="custom">Personalizado</option>
          </select>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className="w-[148px]"
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="w-[148px]"
                aria-label="Data final"
              />
            </div>
          )}
          {!compact && <div className="flex items-center gap-0.5 rounded border border-border bg-background p-[2px]">
            {([["classic", "Clássico"], ["editorial", "Workspace"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setVariant(key)}
                aria-pressed={variant === key}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-all ${
                  variant === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>}
          <Button variant="outline" size="sm" onClick={() => loadAnalytics(dateRange)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-6 pt-4">
          <Alert variant="destructive">
            <AlertTitle>Erro ao carregar analytics</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className={compact ? overviewStyles.content : "min-h-0 flex-1 overflow-auto px-6 py-6 md:px-8"}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando indicadores...
          </div>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Não foi possível carregar os indicadores. Clique em Atualizar para tentar novamente.</p>
        ) : compact || variant === "editorial" ? (
          compact ? <TenantOverview data={data} tenantSlug={tenantSlug} /> : <DashboardEditorial data={data} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="conversas" value={data.stats.conversations} delta={data.deltas.conversations} icon={MessageSquare} />
              <StatCard label="composições" value={data.stats.compositions} delta={data.deltas.compositions} icon={Zap} />
              <StatCard label="contatos" value={data.stats.contacts} delta={data.deltas.contacts} icon={Users} />
              <StatCard label="conclusão" value={data.stats.compositions > 0 ? `${data.stats.completionRate}%` : "—"} delta={data.deltas.completionRate} icon={BarChart3} />
            </div>

            <div className="grid gap-3 xl:grid-cols-[2fr_1fr]">
              <section className="border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">atividade</h4>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#31c48d]" />conversas</span>
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />composições</span>
                  </div>
                </div>
                <div className="h-[240px] min-w-0">
                  {hasTimelineData ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <LineChart data={data.conversationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                        <XAxis dataKey="name" stroke={chartAxisColor} tick={{ fill: chartAxisColor }} fontSize={11} />
                        <YAxis stroke={chartAxisColor} tick={{ fill: chartAxisColor }} fontSize={11} />
                        <Tooltip />
                        <Line type="monotone" dataKey="conversas" stroke="#31c48d" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="composicoes" stroke="#60a5fa" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="contatos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label={`sem dados em ${data.meta.label}`} />
                  )}
                </div>
              </section>

              <section className="border border-border bg-card p-4">
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">por modo</h4>
                <div className="h-[240px] min-w-0">
                  {hasCompositionModes ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={data.compositionModeData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                          {data.compositionModeData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="sem dados de composição" />
                  )}
                </div>
              </section>
            </div>

            {!compact && (
              <div className="grid gap-3 xl:grid-cols-2">
                <section className="border border-border bg-card p-4">
                  <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">atendimento por hora</h4>
                  <div className="h-[220px] min-w-0">
                    {hasHourlyData ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart data={data.hourlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
                          <XAxis dataKey="hour" stroke={chartAxisColor} tick={{ fill: chartAxisColor }} fontSize={11} interval={2} />
                          <YAxis stroke={chartAxisColor} tick={{ fill: chartAxisColor }} fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="ia" stackId="a" fill="#31c48d" />
                          <Bar dataKey="operador" stackId="a" fill="#60a5fa" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="sem dados de mensagens" />
                    )}
                  </div>
                </section>

                <section className="border border-border bg-card p-4">
                  <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">tempos de resposta</h4>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        icon: Bot,
                        label: "ia",
                        value: data.responseTimes.aiLabel ?? "n/d",
                        pct: data.responseTimes.aiFastRate ?? 0,
                      },
                      {
                        icon: Users,
                        label: "operador",
                        value: data.responseTimes.operatorLabel ?? "n/d",
                        pct: data.responseTimes.operatorFastRate ?? 0,
                      },
                    ].map((response) => {
                      const ResponseIcon = response.icon
                      return (
                        <div key={response.label} className="border border-border bg-muted/40 p-3">
                          <div className="flex items-center gap-3">
                            <ResponseIcon className="h-3.5 w-3.5 text-primary" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{response.label}</span>
                                <span className="font-mono text-base font-semibold text-foreground">{response.value}</span>
                              </div>
                              <div className="mt-2 h-[3px] overflow-hidden bg-border">
                                <div className="h-full bg-primary" style={{ width: `${response.pct}%` }} />
                              </div>
                            </div>
                          </div>
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
