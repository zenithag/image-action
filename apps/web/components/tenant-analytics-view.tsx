"use client"

import { useEffect, useState } from "react"

import { AnalyticsFlat } from "@/components/analytics-flat"
import { PageHeader } from "@/components/organisms/page-header"
import { Button as SpectrumButton, Select as SpectrumSelect } from "@/components/spectrum"
import { Input } from "@/components/spectrum/fields"
import { Loader2, RefreshCw } from "@/components/spectrum/icons"
import { TenantOverview } from "@/components/tenant-overview"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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
  operatorGenerationData: Array<{ id: string | null; name: string; generations: number; completed: number; failed: number }>
  reviewQueue: Array<{
    operatorName: string
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

const PERIOD_OPTIONS = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "custom", label: "Personalizado" },
]

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

export function TenantAnalyticsView({ tenantSlug, compact = false }: TenantAnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  const periodOptions = [
    { value: "7d", label: "Últimos 7 dias" },
    { value: "30d", label: "Últimos 30 dias" },
    { value: "month", label: "Este mês" },
    { value: "custom", label: "Personalizado" },
  ]

  const controls = (
    <>
      <SpectrumSelect
        label="Período dos indicadores"
        width={200}
        value={dateRange}
        onValueChange={(value) => setDateRange(value as DateRange)}
        options={periodOptions}
      />
      {dateRange === "custom" && (
        <>
          <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="w-[148px]" aria-label="Data inicial" />
          <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="w-[148px]" aria-label="Data final" />
        </>
      )}
      <SpectrumButton
        disabled={isLoading}
        onClick={() => loadAnalytics(dateRange)}
        icon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      >
        Atualizar
      </SpectrumButton>
    </>
  )

  const errorAlert = error && (
    <div className="px-8 pt-4">
      <Alert variant="destructive">
        <AlertTitle>Erro ao carregar analytics</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    </div>
  )

  const body = isLoading && !data ? (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Carregando indicadores...
    </div>
  ) : !data ? (
    <p className="py-10 text-center text-sm text-muted-foreground">Não foi possível carregar os indicadores. Clique em Atualizar para tentar novamente.</p>
  ) : null

  // Visão geral (compact) and Analytics share one frame: page header + flat sections.
  const title = compact ? "Visão geral" : "analytics"
  const subtitle = compact ? "Acompanhe a operação da sua empresa." : `${tenantSlug} · ${data?.meta.label ?? ""}`

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader title={title} subtitle={subtitle} actions={controls} />
      {errorAlert}
      <div className="min-h-0 flex-1 overflow-auto">
        {body ?? (compact ? <TenantOverview data={data!} tenantSlug={tenantSlug} /> : <AnalyticsFlat data={data!} />)}
      </div>
    </div>
  )
}
