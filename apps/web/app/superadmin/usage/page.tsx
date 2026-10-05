"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { useEffect, useMemo, useState } from "react"
import { Activity, ArrowDown, ArrowUp, Bot, Loader2, MessageSquare, RefreshCw, Smartphone, Users, Zap } from "@/components/spectrum/icons"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type UsagePayload = {
  totals: {
    tenants: number
    conversations: number
    compositions: number
    contacts: number
    connectedInstances: number
    activeProviders: number
  }
  deltas: {
    conversations: number
    compositions: number
    contacts: number
  }
  weeklyData: Array<{
    name: string
    conversas: number
    composicoes: number
    contatos: number
  }>
  topTenants: Array<{
    id: string
    name: string
    slug: string
    planCode: "starter" | "pro" | "enterprise"
    conversations: number
    compositions: number
    contacts: number
    connectedInstances: number
  }>
  providerSummary: {
    total: number
    active: number
    warning: number
    error: number
  }
}

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

function Delta({ value }: { value?: number | null }) {
  if (value == null) return <span className="mt-1 text-xs text-muted-foreground">sem histórico</span>

  const positive = value >= 0
  return (
    <span className={cn("mt-1 flex items-center gap-1 text-xs", positive ? "text-primary" : "text-warning")}>
      {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(value)}% vs 7 dias anteriores
    </span>
  )
}

export default function UsagePage() {
  const [data, setData] = useState<UsagePayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadUsage() {
    setIsLoading(true)
    setError(null)

    try {
      const payload = await requestJson<UsagePayload>("/api/superadmin/usage")
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o uso.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsage()
  }, [])

  const maxConversations = useMemo(() =>
    data?.topTenants.length ? data.topTenants[0].conversations : 0,
  [data])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-7">
        <div className="mr-auto flex flex-col">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Observabilidade</p>
          <h1 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">Uso da plataforma</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadUsage} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
        <UserMenu />
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-3 px-7 py-4">
        {[
          { label: "Mensagens", value: data?.totals.conversations ?? 0, delta: data?.deltas.conversations, icon: MessageSquare },
          { label: "Jobs IA", value: data?.totals.compositions ?? 0, delta: data?.deltas.compositions, icon: Zap },
          { label: "Contatos", value: data?.totals.contacts ?? 0, delta: data?.deltas.contacts, icon: Users },
          { label: "Instâncias conectadas", value: data?.totals.connectedInstances ?? 0, delta: null, icon: Smartphone },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-md border border-border bg-card p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <kpi.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-[26px] font-medium leading-none text-foreground">{kpi.value}</p>
            <Delta value={kpi.delta} />
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-2 scrollbar-hide">
        {isLoading && !data ? (
          <div className="flex h-full items-center justify-center rounded-md border border-border bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando dados reais...</p>
            </div>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-[1.6fr_1fr] gap-4">
              <div className="rounded-md border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-semibold text-foreground">Volume da plataforma</h3>
                    <p className="text-xs text-muted-foreground">Conversas, composições e contatos dos últimos 7 dias</p>
                  </div>
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">7 dias</span>
                </div>
                <div className="h-[260px]">
                  {data.weeklyData.some((item) => item.conversas > 0 || item.composicoes > 0 || item.contatos > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Area type="monotone" dataKey="conversas" stroke="var(--cf-chart-2)" fill="var(--cf-chart-2)" fillOpacity={0.15} strokeWidth={2} />
                        <Area type="monotone" dataKey="composicoes" stroke="var(--cf-chart-1)" fill="var(--cf-chart-1)" fillOpacity={0.1} strokeWidth={2} />
                        <Area type="monotone" dataKey="contatos" stroke="var(--cf-chart-3)" fill="var(--cf-chart-3)" fillOpacity={0.08} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem atividade real suficiente para o gráfico.</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="font-display text-base font-semibold text-foreground">Top 5 tenants</h3>
                  <p className="text-xs text-muted-foreground">Mais ativos por conversas reais</p>
                </div>
                <div className="space-y-3">
                  {data.topTenants.length > 0 ? data.topTenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium text-white" style={{ background: `hsl(${(tenant.name.charCodeAt(0) * 37) % 360}, 55%, 50%)` }}>
                        {tenant.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate font-medium text-foreground">{tenant.name}</span>
                          <span className="text-xs text-muted-foreground">{tenant.conversations}</span>
                        </div>
                        <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${maxConversations > 0 ? (tenant.conversations / maxConversations) * 100 : 0}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tenant.slug} · {tenant.connectedInstances} instância{tenant.connectedInstances === 1 ? "" : "s"} conectada{tenant.connectedInstances === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nenhum tenant com atividade ainda.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-md border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-base font-semibold text-foreground">Resumo operacional</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-secondary/50 p-4">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Tenants cadastrados</p>
                    <p className="mt-2 text-2xl font-medium text-foreground">{data.totals.tenants}</p>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/50 p-4">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Providers ativos</p>
                    <p className="mt-2 text-2xl font-medium text-foreground">{data.providerSummary.active}</p>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/50 p-4">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Providers em alerta</p>
                    <p className="mt-2 text-2xl font-medium text-foreground">{data.providerSummary.warning + data.providerSummary.error}</p>
                  </div>
                  <div className="rounded-md border border-border bg-secondary/50 p-4">
                    <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Custo de infra</p>
                    <p className="mt-2 text-2xl font-medium text-foreground">n/d</p>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-base font-semibold text-foreground">Leitura atual</h2>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>A tela agora usa apenas dados reais dos stores de conversas, contatos, jobs, providers e instâncias.</p>
                  <p>Custos financeiros ainda aparecem como <span className="font-medium text-foreground">n/d</span> porque o sistema não persiste cobrança operacional real.</p>
                  <p>Quando a base crescer, o próximo passo natural é fechar corte por período customizado e custos por provider.</p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
