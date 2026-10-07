"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { Modal } from "@/components/spectrum/modal"
import { ToggleButton } from "@/components/spectrum/toggle-button"
import { Input, NativeSelect, Textarea } from "@/components/spectrum/fields"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Globe2,
  MessageCircle,
  Plus,
  Search,
  Send,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wrench,
  Zap,
} from "@/components/spectrum/icons"
import { Button } from "@/components/ui/button"
import type { ChannelPlanLimit } from "@/lib/channel-plan-types"
import { defaultChannelPlanLimits } from "@/lib/channel-plan-types"
import { cn } from "@/lib/utils"

type ProviderStatus = "active" | "maintenance" | "disabled"
type ChannelKind = "whatsapp" | "instagram" | "telegram"
type InstanceStatus = "connected" | "pending" | "error"

type ProviderAccount = {
  id: string
  name: string
  kind: ChannelKind
  provider: "uazapi" | "meta" | "telegram-bot-api"
  status: ProviderStatus
  baseUrl?: string
  adminTokenConfigured?: boolean
  contractedCapacity?: number
  reservedCapacity?: number
  usedCapacity: number
  health: "ok" | "warning" | "error"
  notes: string
  createdAt?: string
}

type TenantChannelInstance = {
  id: string
  tenantId?: string
  tenant: string
  tenantSlug: string
  channel: ChannelKind
  providerAccount: string
  label: string
  plan: "starter" | "pro" | "enterprise" | "custom"
  status: InstanceStatus
  phoneNumber?: string
  connected: boolean
  loggedIn: boolean
  createdAt: string
}

type NewProviderForm = {
  name: string
  kind: ChannelKind
  provider: ProviderAccount["provider"]
  baseUrl: string
  adminToken: string
  contractedCapacity: string
  reservedCapacity: string
  notes: string
}

type ProviderTestResult = {
  ok: boolean
  status: "success" | "warning" | "error"
  message: string
  httpStatus?: number
  latencyMs?: number
  instanceCount?: number
  checkedAt: string
}

const channelConfig: Record<ChannelKind, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  whatsapp: { label: "WhatsApp", icon: Smartphone, color: "text-success", bg: "bg-success/10" },
  instagram: { label: "Instagram", icon: MessageCircle, color: "text-pink-500", bg: "bg-pink-500/10" },
  telegram: { label: "Telegram", icon: Send, color: "text-info", bg: "bg-info/10" },
}

const statusLabel: Record<ProviderStatus, string> = {
  active: "Ativo",
  maintenance: "Manutencao",
  disabled: "Inativo",
}

const instanceStatusLabel: Record<InstanceStatus, string> = {
  connected: "Conectado",
  pending: "Pendente",
  error: "Erro",
}

function getAvailableCapacity(provider: ProviderAccount) {
  if (!provider.contractedCapacity) return null
  return provider.contractedCapacity - provider.usedCapacity - (provider.reservedCapacity ?? 0)
}

const defaultNewProviderForm: NewProviderForm = {
  name: "",
  kind: "whatsapp",
  provider: "uazapi",
  baseUrl: "",
  adminToken: "",
  contractedCapacity: "100",
  reservedCapacity: "5",
  notes: "",
}

export default function ChannelsPage() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"providers" | "instances" | "plans">("providers")
  const [providers, setProviders] = useState<ProviderAccount[]>([])
  const [instances, setInstances] = useState<TenantChannelInstance[]>([])
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)
  const [isLoadingInstances, setIsLoadingInstances] = useState(true)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [isCreatingProvider, setIsCreatingProvider] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({})
  const [isNewProviderOpen, setIsNewProviderOpen] = useState(false)
  const [newProvider, setNewProvider] = useState<NewProviderForm>(defaultNewProviderForm)
  const [planLimits, setPlanLimits] = useState<ChannelPlanLimit[]>([
    { ...defaultChannelPlanLimits.starter, updatedAt: "" },
    { ...defaultChannelPlanLimits.pro, updatedAt: "" },
    { ...defaultChannelPlanLimits.enterprise, updatedAt: "" },
    { ...defaultChannelPlanLimits.custom, updatedAt: "" },
  ])
  const [isLoadingPlans, setIsLoadingPlans] = useState(true)
  const [isSavingPlans, setIsSavingPlans] = useState(false)

  async function loadData() {
    setIsLoadingProviders(true)
    setIsLoadingInstances(true)
    setIsLoadingPlans(true)
    setProviderError(null)

    try {
      const [providersResponse, instancesResponse, planLimitsResponse] = await Promise.all([
        fetch("/api/superadmin/providers", { cache: "no-store" }),
        fetch("/api/superadmin/channel-instances", { cache: "no-store" }),
        fetch("/api/superadmin/channel-plan-limits", { cache: "no-store" }),
      ])

      if (!providersResponse.ok) {
        throw new Error("Nao foi possivel carregar os providers.")
      }

      if (!instancesResponse.ok) {
        throw new Error("Nao foi possivel carregar as instancias dos tenants.")
      }

      if (!planLimitsResponse.ok) {
        throw new Error("Nao foi possivel carregar os limites por plano.")
      }

      const [providersData, instancesData, planLimitsData] = await Promise.all([
        providersResponse.json() as Promise<ProviderAccount[]>,
        instancesResponse.json() as Promise<TenantChannelInstance[]>,
        planLimitsResponse.json() as Promise<ChannelPlanLimit[]>,
      ])

      setProviders(providersData)
      setInstances(instancesData)
      setPlanLimits(planLimitsData)
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Erro ao carregar canais.")
    } finally {
      setIsLoadingProviders(false)
      setIsLoadingInstances(false)
      setIsLoadingPlans(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const whatsappProviders = providers.filter((account) => account.provider === "uazapi")
  const totalContracted = whatsappProviders.reduce((sum, account) => sum + (account.contractedCapacity ?? 0), 0)
  const totalReserved = whatsappProviders.reduce((sum, account) => sum + (account.reservedCapacity ?? 0), 0)
  const totalUsed = whatsappProviders.reduce((sum, account) => sum + account.usedCapacity, 0)
  const totalAvailable = totalContracted - totalReserved - totalUsed

  const filteredProviders = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return providers
    return providers.filter((provider) =>
      [provider.name, provider.provider, provider.kind, provider.notes].some((field) =>
        field.toLowerCase().includes(value)
      )
    )
  }, [providers, search])

  const filteredInstances = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return instances
    return instances.filter((instance) =>
      [instance.tenant, instance.tenantSlug, instance.label, instance.providerAccount, instance.channel, instance.status, instance.phoneNumber || ""].some((field) =>
        field.toLowerCase().includes(value)
      )
    )
  }, [instances, search])

  function updateNewProvider<K extends keyof NewProviderForm>(key: K, value: NewProviderForm[K]) {
    if (key === "kind") {
      const providerByKind: Record<ChannelKind, ProviderAccount["provider"]> = {
        whatsapp: "uazapi",
        instagram: "meta",
        telegram: "telegram-bot-api",
      }

      setNewProvider((current) => ({
        ...current,
        kind: value as ChannelKind,
        provider: providerByKind[value as ChannelKind],
        adminToken: value === "whatsapp" ? current.adminToken : "",
        contractedCapacity: value === "whatsapp" ? current.contractedCapacity || "100" : "",
        reservedCapacity: value === "whatsapp" ? current.reservedCapacity || "5" : "",
      }))
      return
    }

    setNewProvider((current) => ({ ...current, [key]: value }))
  }

  function updatePlanLimit<K extends keyof ChannelPlanLimit>(
    planCode: ChannelPlanLimit["planCode"],
    key: K,
    value: ChannelPlanLimit[K]
  ) {
    setPlanLimits((current) =>
      current.map((plan) => (plan.planCode === planCode ? { ...plan, [key]: value } : plan))
    )
  }

  async function createProvider() {
    const name = newProvider.name.trim()
    if (!name || isCreatingProvider) return

    setIsCreatingProvider(true)
    setProviderError(null)

    try {
      const response = await fetch("/api/superadmin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind: newProvider.kind,
          provider: newProvider.provider,
          baseUrl: newProvider.baseUrl.trim(),
          adminToken: newProvider.adminToken.trim(),
          contractedCapacity: newProvider.contractedCapacity,
          reservedCapacity: newProvider.reservedCapacity,
          notes: newProvider.notes.trim(),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || "Nao foi possivel salvar o provider.")
      }

      const provider = await response.json() as ProviderAccount
      setProviders((current) => [provider, ...current])
      setSearch("")
      setActiveTab("providers")
      setIsNewProviderOpen(false)
      setNewProvider(defaultNewProviderForm)
      void loadData()
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Erro ao salvar provider.")
    } finally {
      setIsCreatingProvider(false)
    }
  }

  async function testProvider(providerId: string) {
    if (testingProviderId) return

    setTestingProviderId(providerId)
    setProviderError(null)

    try {
      const response = await fetch(`/api/superadmin/providers/${providerId}/test`, {
        method: "POST",
      })
      const result = await response.json() as ProviderTestResult | { error?: string }

      if (!response.ok && "error" in result) {
        throw new Error(result.error || "Nao foi possivel testar o provider.")
      }

      const testResult = result as ProviderTestResult
      setTestResults((current) => ({ ...current, [providerId]: testResult }))
      setProviders((current) =>
        current.map((provider) =>
          provider.id === providerId
            ? { ...provider, health: testResult.ok ? "ok" : "error" }
            : provider
        )
      )
      void loadData()
    } catch (error) {
      const fallbackResult: ProviderTestResult = {
        ok: false,
        status: "error",
        message: error instanceof Error ? error.message : "Erro ao testar provider.",
        checkedAt: new Date().toISOString(),
      }
      setTestResults((current) => ({ ...current, [providerId]: fallbackResult }))
      setProviders((current) =>
        current.map((provider) =>
          provider.id === providerId ? { ...provider, health: "error" } : provider
        )
      )
    } finally {
      setTestingProviderId(null)
    }
  }

  async function deleteProvider(provider: ProviderAccount) {
    if (deletingProviderId) return

    const shouldDelete = window.confirm(`Excluir o provider "${provider.name}"? Esta acao nao pode ser desfeita.`)
    if (!shouldDelete) return

    setDeletingProviderId(provider.id)
    setProviderError(null)

    try {
      const response = await fetch(`/api/superadmin/providers/${provider.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || "Nao foi possivel excluir o provider.")
      }

      setProviders((current) => current.filter((item) => item.id !== provider.id))
      setTestResults((current) => {
        const { [provider.id]: _removed, ...nextResults } = current
        return nextResults
      })
      void loadData()
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Erro ao excluir provider.")
    } finally {
      setDeletingProviderId(null)
    }
  }

  async function savePlanLimits() {
    if (isSavingPlans) return

    setIsSavingPlans(true)
    setProviderError(null)

    try {
      const response = await fetch("/api/superadmin/channel-plan-limits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plans: planLimits.map((plan) => ({
            planCode: plan.planCode,
            label: plan.label,
            whatsapp: plan.whatsapp,
            instagram: plan.instagram,
            telegram: plan.telegram,
            catalogIncluded: plan.catalogIncluded,
            conversationsLimit: plan.conversationsLimit,
            extra: plan.extra,
          })),
        }),
      })
      const payload = await response.json().catch(() => null) as ChannelPlanLimit[] | { error?: string } | null

      if (!response.ok) {
        throw new Error(typeof payload === "object" && payload && "error" in payload ? payload.error || "Nao foi possivel salvar os limites por plano." : "Nao foi possivel salvar os limites por plano.")
      }

      setPlanLimits(payload as ChannelPlanLimit[])
    } catch (error) {
      setProviderError(error instanceof Error ? error.message : "Erro ao salvar os limites por plano.")
    } finally {
      setIsSavingPlans(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[var(--cf-chrome-bg,var(--background))] px-4 py-2 sm:px-8">
        <div className="mr-auto flex flex-col">
          <p className="text-xs leading-tight text-muted-foreground">Canais</p>
          <h1 className="text-base font-bold leading-tight text-foreground">Instâncias WhatsApp</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoadingProviders || isLoadingInstances}>
            <Wrench className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setIsNewProviderOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Provider
          </Button>
        </div>
        <UserMenu />
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3 px-4 py-4 sm:px-7">
        {[
          { label: "UAZAPI contratadas", value: totalContracted, icon: Server, tone: "text-foreground" },
          { label: "Instancias em uso", value: totalUsed, icon: Smartphone, tone: "text-primary" },
          { label: "Reserva operacional", value: totalReserved, icon: ShieldCheck, tone: "text-warning" },
          { label: "Disponiveis", value: totalAvailable, icon: Zap, tone: totalAvailable > 10 ? "text-primary" : "text-destructive" },
        ].map((metric) => (
          <div key={metric.label} className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <metric.icon className={cn("h-4 w-4", metric.tone)} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</p>
              <p className="text-lg font-medium leading-tight text-foreground">{metric.value}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-7">
        <div className="flex max-w-full flex-wrap gap-1">
          {[
            { id: "providers", label: "Provedores globais" },
            { id: "instances", label: "Instancias dos tenants" },
            { id: "plans", label: "Limites por plano" },
          ].map((tab) => (
            <ToggleButton selected={activeTab === tab.id} key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}>
              {tab.label}
            </ToggleButton>
          ))}
        </div>

        <div className="relative w-full min-w-0 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar canal, provider ou tenant..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-input bg-secondary py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {providerError && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {providerError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-hide sm:px-7">
        {activeTab === "providers" && (
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="grid gap-4">
              {isLoadingProviders ? (
                <EmptyState
                  title="Carregando providers..."
                  description="Buscando os providers persistidos localmente."
                />
              ) : filteredProviders.length > 0 ? (
                filteredProviders.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    isTesting={testingProviderId === provider.id}
                    isDeleting={deletingProviderId === provider.id}
                    testResult={testResults[provider.id]}
                    onTest={() => testProvider(provider.id)}
                    onDelete={() => deleteProvider(provider)}
                  />
                ))
              ) : (
                <EmptyState
                  title="Nenhum provider cadastrado"
                  description="Cadastre o primeiro provider global. A lista nao usa mais dados mockados."
                  actionLabel="Novo Provider"
                  onAction={() => setIsNewProviderOpen(true)}
                />
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-md border border-border bg-card p-5">
                <h2 className="font-bold text-foreground font-display">Como alocar WhatsApp</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  O Superadmin cadastra os UAZAPIs e informa manualmente a capacidade contratada. O tenant cria as instancias WhatsApp dentro do proprio ambiente, respeitando o plano. A plataforma escolhe um UAZAPI ativo com capacidade disponivel.
                </p>
                <div className="mt-4 space-y-3 text-sm">
                  <RuleItem label="1" text="Validar limite do plano do tenant." />
                  <RuleItem label="2" text="Selecionar primeiro o UAZAPI ativo com menos instancias em uso." />
                  <RuleItem label="3" text="Criar instancia e gerar QR Code para o tenant." />
                  <RuleItem label="4" text="Roteiar webhooks por tenant_id e channel_instance_id." />
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-5">
                <h2 className="font-bold text-foreground font-display">Instagram e Telegram</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  O Superadmin controla o conector global. A autorizacao final fica no tenant, porque a conta Instagram Business/Page e o bot Telegram pertencem ao cliente.
                </p>
              </div>
            </aside>
          </div>
        )}

        {activeTab === "instances" && (
            <div className="max-w-full overflow-x-auto rounded-md border border-border bg-card">
            {isLoadingInstances ? (
              <EmptyState
                title="Carregando instâncias..."
                description="Buscando as conexões já criadas pelos tenants."
              />
            ) : filteredInstances.length > 0 ? (
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Tenant</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Canal</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Instancia</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Provider</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Plano</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Telefone</th>
                    <th className="px-5 py-3.5 text-right text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Criada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInstances.map((instance) => {
                    const config = channelConfig[instance.channel]
                    const Icon = config.icon

                    return (
                      <tr key={instance.id} className="transition-colors hover:bg-primary/[0.02]">
                        <td className="px-5 py-4">
                          <p className="font-bold text-foreground font-display">{instance.tenant}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2 text-sm">
                            <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", config.bg)}>
                              <Icon className={cn("h-4 w-4", config.color)} />
                            </span>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-medium text-foreground">{instance.label}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{instance.providerAccount}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-[4px] bg-muted px-2.5 py-1 text-xs font-medium uppercase text-muted-foreground">
                            {instance.plan}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <InstanceStatusBadge status={instance.status} />
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{instance.phoneNumber || "—"}</td>
                        <td className="px-5 py-4 text-right text-sm text-muted-foreground">{instance.createdAt}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="Nenhuma instancia de tenant"
                  description="As instâncias reais aparecem aqui assim que forem criadas pelos tenants."
                />
              )}
            </div>
        )}

        {activeTab === "plans" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border bg-card p-4">
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">Limites por plano</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Regras persistidas de canais e faixa de uso por tenant.
                </p>
              </div>
              <Button onClick={() => void savePlanLimits()} disabled={isLoadingPlans || isSavingPlans}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {isSavingPlans ? "Salvando..." : "Salvar limites"}
              </Button>
            </div>

            {isLoadingPlans ? (
              <EmptyState
                title="Carregando limites..."
                description="Buscando a configuração persistida dos planos."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {planLimits.map((plan) => (
                  <div key={plan.planCode} className="rounded-md border border-border bg-card p-6">
                    <h2 className="text-lg font-bold text-foreground font-display">{plan.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Capacidade inicial concedida ao tenant neste plano.</p>
                    <label className="mt-4 flex items-center gap-2"><input type="checkbox" checked={plan.catalogIncluded} onChange={event => setPlanLimits(current => current.map(item => item.planCode === plan.planCode ? { ...item, catalogIncluded: event.target.checked } : item))} />Catálogo incluído no plano</label>
                    <div className="mt-6 space-y-4">
                      <PlanLimitInput
                        label="WhatsApp"
                        value={plan.whatsapp}
                        icon={Smartphone}
                        onChange={(value) => updatePlanLimit(plan.planCode, "whatsapp", value)}
                      />
                      <PlanLimitInput
                        label="Instagram"
                        value={plan.instagram}
                        icon={MessageCircle}
                        onChange={(value) => updatePlanLimit(plan.planCode, "instagram", value)}
                      />
                      <PlanLimitInput
                        label="Telegram"
                        value={plan.telegram}
                        icon={Send}
                        onChange={(value) => updatePlanLimit(plan.planCode, "telegram", value)}
                      />
                      <PlanLimitInput
                        label="Conversas"
                        value={plan.conversationsLimit}
                        icon={Bot}
                        onChange={(value) => updatePlanLimit(plan.planCode, "conversationsLimit", value)}
                      />
                    </div>
                    <div className="mt-6 space-y-2">
                      <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Observação operacional</span>
                      <Textarea
                        value={plan.extra}
                        onChange={(event) => updatePlanLimit(plan.planCode, "extra", event.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Atualizado em {plan.updatedAt ? new Date(plan.updatedAt).toLocaleString("pt-BR") : "agora"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isNewProviderOpen && (
        <NewProviderModal
          form={newProvider}
          onChange={updateNewProvider}
          onClose={() => setIsNewProviderOpen(false)}
          onCreate={createProvider}
          isCreating={isCreatingProvider}
        />
      )}
    </div>
  )
}

function ProviderCard({
  provider,
  isTesting,
  isDeleting,
  testResult,
  onTest,
  onDelete,
}: {
  provider: ProviderAccount
  isTesting: boolean
  isDeleting: boolean
  testResult?: ProviderTestResult
  onTest: () => void
  onDelete: () => void
}) {
  const config = channelConfig[provider.kind]
  const Icon = config.icon
  const available = getAvailableCapacity(provider)
  const capacityPercent = provider.contractedCapacity
    ? Math.round((provider.usedCapacity / provider.contractedCapacity) * 100)
    : null

  return (
    <article className="rounded-md border border-border bg-card p-6 transition-all hover:border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-md", config.bg)}>
            <Icon className={cn("h-6 w-6", config.color)} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-foreground font-display">{provider.name}</h2>
              <ProviderStatusBadge status={provider.status} />
              <HealthBadge health={provider.health} />
            </div>
            <p className="mt-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">
              {config.label} / {provider.provider}
            </p>
            {provider.baseUrl && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" />
                {provider.baseUrl}
              </p>
            )}
            {provider.provider === "uazapi" && provider.adminTokenConfigured && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin token configurado
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-md"
            onClick={onTest}
            disabled={isTesting}
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            {isTesting ? "Testando" : "Testar"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {isDeleting ? "Excluindo" : "Excluir"}
          </Button>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{provider.notes}</p>

      {testResult && (
        <div
          className={cn(
            "mt-5 rounded-md border p-4 text-sm",
            testResult.ok
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-start gap-2">
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-bold">{testResult.ok ? "Conexao validada" : "Falha no teste de conexao"}</p>
              <p className="mt-1 text-current/85">{testResult.message}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-current/70">
                {typeof testResult.httpStatus === "number" && <span>HTTP {testResult.httpStatus}</span>}
                {typeof testResult.latencyMs === "number" && <span>{testResult.latencyMs}ms</span>}
                {typeof testResult.instanceCount === "number" && <span>{testResult.instanceCount} instancias</span>}
                <span>{new Date(testResult.checkedAt).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {provider.provider === "uazapi" ? (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CapacityBox label="Contratada" value={provider.contractedCapacity ?? 0} />
            <CapacityBox label="Em uso" value={provider.usedCapacity} />
            <CapacityBox label="Reservada" value={provider.reservedCapacity ?? 0} />
            <CapacityBox label="Disponivel" value={available ?? 0} tone={(available ?? 0) > 5 ? "default" : "danger"} />
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Uso da capacidade contratada</span>
              <span>{capacityPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", (capacityPercent ?? 0) > 85 ? "bg-destructive" : "bg-primary")}
                style={{ width: `${Math.min(capacityPercent ?? 0, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <CapacityBox label="Contas conectadas" value={provider.usedCapacity} />
          <CapacityBox label="Conexao" value={provider.status === "active" ? "OAuth tenant" : "Bloqueada"} />
        </div>
      )}
    </article>
  )
}

function NewProviderModal({
  form,
  onChange,
  onClose,
  onCreate,
  isCreating,
}: {
  form: NewProviderForm
  onChange: <K extends keyof NewProviderForm>(key: K, value: NewProviderForm[K]) => void
  onClose: () => void
  onCreate: () => Promise<void>
  isCreating: boolean
}) {
  const config = channelConfig[form.kind]
  const Icon = config.icon
  const isUazapi = form.provider === "uazapi"
  const canCreate = form.name.trim().length > 0 && (
    !isUazapi ||
    (form.baseUrl.trim().length > 0 && form.adminToken.trim().length > 0 && Number(form.contractedCapacity) > 0)
  )

  return (
    <Modal onClose={onClose} className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto p-4">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-primary">Superadmin</p>
            <h2 className="mt-1 text-xl font-bold text-foreground font-display">Novo provider de canal</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre infraestrutura global. As instancias finais continuam vinculadas aos tenants.
            </p>
          </div>
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-md", config.bg)}>
            <Icon className={cn("h-6 w-6", config.color)} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            {([
              { kind: "whatsapp", label: "WhatsApp", provider: "uazapi" },
              { kind: "instagram", label: "Instagram", provider: "meta" },
              { kind: "telegram", label: "Telegram", provider: "telegram-bot-api" },
            ] as Array<{ kind: ChannelKind; label: string; provider: ProviderAccount["provider"] }>).map((option) => {
              const optionConfig = channelConfig[option.kind]
              const OptionIcon = optionConfig.icon

              return (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => onChange("kind", option.kind)}
                  className={cn(
                    "rounded-md border p-4 text-left transition-all",
                    form.kind === option.kind
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:border-primary/30"
                  )}
                >
                  <span className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-md", optionConfig.bg)}>
                    <OptionIcon className={cn("h-4 w-4", optionConfig.color)} />
                  </span>
                  <span className="block text-sm font-bold text-foreground">{option.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{option.provider}</span>
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Nome interno</span>
              <Input
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder={isUazapi ? "UAZAPI Sao Paulo 01" : form.kind === "instagram" ? "Meta App Principal" : "Telegram Adapter Principal"}
                className="w-full rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Provider tecnico</span>
              <NativeSelect
                value={form.provider}
                onChange={(event) => onChange("provider", event.target.value as ProviderAccount["provider"])}
                className="w-full rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="uazapi">uazapi</option>
                <option value="meta">meta</option>
                <option value="telegram-bot-api">telegram-bot-api</option>
              </NativeSelect>
            </label>
          </div>

          <label className="block space-y-2">
            <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {isUazapi ? "Base URL do UAZAPI" : "URL / identificador do conector"}
            </span>
            <Input
              value={form.baseUrl}
              onChange={(event) => onChange("baseUrl", event.target.value)}
              placeholder={isUazapi ? "https://api.uazapi.dev/seu-endpoint" : "https://graph.facebook.com/app ou adapter interno"}
              className="w-full rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          {isUazapi && (
            <>
              <label className="block space-y-2">
                <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Admin token</span>
                <Input
                  type="password"
                  value={form.adminToken}
                  onChange={(event) => onChange("adminToken", event.target.value)}
                  placeholder="Cole aqui o admintoken do provider"
                  autoComplete="off"
                  className="w-full rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Capacidade contratada</span>
                  <Input
                    type="number"
                    min={1}
                    value={form.contractedCapacity}
                    onChange={(event) => onChange("contractedCapacity", event.target.value)}
                    className="w-full rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Reserva operacional</span>
                  <Input
                    type="number"
                    min={0}
                    value={form.reservedCapacity}
                    onChange={(event) => onChange("reservedCapacity", event.target.value)}
                    className="w-full rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>
            </>
          )}

          <label className="block space-y-2">
            <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Observacoes</span>
            <Textarea
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              placeholder="Ex: provider dedicado para clientes enterprise, nao receber novas instancias sem aprovacao..."
              className="h-24 w-full resize-none rounded-md border border-input bg-muted/20 px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            {isUazapi
              ? "Este provider entra no pool de alocacao WhatsApp. A capacidade disponivel sera calculada como contratada menos instancias em uso menos reserva."
              : "Este provider habilita o conector global. A conta final sera conectada dentro do tenant por OAuth/token."}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" className="rounded-md" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="rounded-md" onClick={onCreate} disabled={!canCreate || isCreating}>
            {isCreating ? "Salvando..." : "Criar provider"}
          </Button>
        </div>
      
    </Modal>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-muted">
        <Server className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-foreground font-display">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-5 rounded-md" onClick={onAction}>
          <Plus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

function CapacityBox({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "danger" }) {
  return (
    <div className="rounded-[4px] border border-border bg-muted/30 p-3">
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold font-display", tone === "danger" ? "text-destructive" : "text-foreground")}>
        {value}
      </p>
    </div>
  )
}

function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium uppercase",
        status === "active" && "bg-primary/10 text-primary",
        status === "maintenance" && "bg-warning/10 text-warning",
        status === "disabled" && "bg-muted text-muted-foreground"
      )}
    >
      {statusLabel[status]}
    </span>
  )
}

function HealthBadge({ health }: { health: ProviderAccount["health"] }) {
  const Icon = health === "ok" ? CheckCircle2 : AlertTriangle

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium uppercase",
        health === "ok" && "bg-primary/10 text-primary",
        health === "warning" && "bg-warning/10 text-warning",
        health === "error" && "bg-destructive/10 text-destructive"
      )}
    >
      <Icon className="h-3 w-3" />
      {health === "ok" ? "Saudavel" : health === "warning" ? "Atencao" : "Erro"}
    </span>
  )
}

function InstanceStatusBadge({ status }: { status: InstanceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium uppercase",
        status === "connected" && "bg-primary/10 text-primary",
        status === "pending" && "bg-warning/10 text-warning",
        status === "error" && "bg-destructive/10 text-destructive"
      )}
    >
      {status === "connected" && <CheckCircle2 className="h-3 w-3" />}
      {status === "pending" && <Bot className="h-3 w-3" />}
      {status === "error" && <AlertTriangle className="h-3 w-3" />}
      {instanceStatusLabel[status]}
    </span>
  )
}

function RuleItem({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {label}
      </span>
      <span className="text-muted-foreground">{text}</span>
    </div>
  )
}

function PlanLimitInput({
  label,
  value,
  icon: Icon,
  onChange,
}: {
  label: string
  value: number
  icon: React.ElementType
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </span>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="h-9 w-24 rounded-md border border-input bg-background px-3 text-right text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </div>
  )
}
