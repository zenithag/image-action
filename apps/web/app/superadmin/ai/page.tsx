"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { Input, Textarea } from "@/components/spectrum/fields"
import { Children, cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  DatabaseZap,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Settings,
  X,
  Trash2,
} from "@/components/spectrum/icons"

import { Button } from "@/components/ui/button"
import { Dialog, Popover } from "radix-ui"
import type { AiGuardrailRecord } from "@/lib/ai-guardrail-types"
import type {
  AiModelProfile,
  AiModelProfilePurpose,
  AiProviderTestResult,
  OpenRouterModelSummary,
  SafeAiProvider,
  UsdBrlExchangeRate,
} from "@/lib/ai-types"
import { formatModelPrices, isModelCompatible } from "@/lib/ai-types"
import { cn } from "@/lib/utils"

type NewProviderForm = {
  name: string
  apiKey: string
  baseUrl: string
  monthlyBudgetCents: string
  notes: string
}

const defaultProviderForm: NewProviderForm = {
  name: "OpenRouter Principal",
  apiKey: "",
  baseUrl: "https://openrouter.ai/api/v1",
  monthlyBudgetCents: "",
  notes: "",
}

const purposeLabel: Record<AiModelProfilePurpose, string> = {
  classification: "Interpretação da conversa",
  conversation: "Atendimento",
  vision: "Leitura da imagem",
  image_prompt: "Preparação do prompt",
  image_generation: "Geração da composição",
  composition_review: "Avaliação de composição",
  fallback: "Modelo de contingência",
}

function formatUsd(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/d"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisicao invalida."
    throw new Error(message)
  }

  return payload as T
}

export default function SuperadminAiPage() {
  const dialogContainer = useRef<HTMLDivElement>(null)
  const modelTable = useRef<HTMLDivElement>(null)
  const [providerDialogOpen, setProviderDialogOpen] = useState(false)
  const [providers, setProviders] = useState<SafeAiProvider[]>([])
  const [profiles, setProfiles] = useState<AiModelProfile[]>([])
  const [models, setModels] = useState<OpenRouterModelSummary[]>([])
  const [guardrails, setGuardrails] = useState<AiGuardrailRecord[]>([])
  const [newProvider, setNewProvider] = useState(defaultProviderForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingProvider, setIsCreatingProvider] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null)
  const [syncingModels, setSyncingModels] = useState(false)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
  const [savingGuardrailId, setSavingGuardrailId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, AiProviderTestResult>>({})
  const [error, setError] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<UsdBrlExchangeRate | null>(null)

  const activeProvider = providers.find((provider) => provider.status === "active" && provider.apiKeyConfigured)
  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models])

  async function loadData() {
    setIsLoading(true)
    setError(null)

    try {
      const [providersData, profilesData, guardrailsData] = await Promise.all([
        requestJson<SafeAiProvider[]>("/api/superadmin/ai/providers", { cache: "no-store" }),
        requestJson<AiModelProfile[]>("/api/superadmin/ai/profiles", { cache: "no-store" }),
        requestJson<AiGuardrailRecord[]>("/api/superadmin/ai/guardrails", { cache: "no-store" }),
      ])

      setProviders(providersData)
      setProfiles(profilesData)
      setGuardrails(guardrailsData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar IA.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (isLoading || syncingModels) {
      return
    }

    void syncModels()
  }, [activeProvider?.id, isLoading])

  async function createProvider() {
    if (isCreatingProvider) return
    setIsCreatingProvider(true)
    setError(null)

    try {
      const provider = await requestJson<SafeAiProvider>("/api/superadmin/ai/providers", {
        method: "POST",
        body: JSON.stringify({
          name: newProvider.name,
          apiKey: newProvider.apiKey,
          baseUrl: newProvider.baseUrl,
          monthlyBudgetCents: newProvider.monthlyBudgetCents,
          notes: newProvider.notes,
        }),
      })

      setProviders((current) => [provider, ...current])
      setNewProvider(defaultProviderForm)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro ao criar provider.")
    } finally {
      setIsCreatingProvider(false)
    }
  }

  async function testProvider(providerId: string) {
    if (testingProviderId) return
    setTestingProviderId(providerId)
    setError(null)

    try {
      const result = await requestJson<AiProviderTestResult & { provider?: SafeAiProvider }>(`/api/superadmin/ai/providers/${providerId}/test`, {
        method: "POST",
      })

      setTestResults((current) => ({ ...current, [providerId]: result }))
      if (result.provider) {
        setProviders((current) => current.map((provider) => provider.id === providerId ? result.provider! : provider))
      }
    } catch (testError) {
      const result: AiProviderTestResult = {
        ok: false,
        status: "error",
        message: testError instanceof Error ? testError.message : "Erro ao testar OpenRouter.",
        checkedAt: new Date().toISOString(),
      }
      setTestResults((current) => ({ ...current, [providerId]: result }))
    } finally {
      setTestingProviderId(null)
    }
  }

  async function deleteProvider(provider: SafeAiProvider) {
    if (deletingProviderId) return
    if (!window.confirm(`Excluir o provider "${provider.name}"?`)) return

    setDeletingProviderId(provider.id)
    setError(null)

    try {
      await requestJson<{ ok: true }>(`/api/superadmin/ai/providers/${provider.id}`, { method: "DELETE" })
      setProviders((current) => current.filter((item) => item.id !== provider.id))
      setTestResults((current) => {
        const { [provider.id]: _removed, ...nextResults } = current
        return nextResults
      })
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao excluir provider.")
    } finally {
      setDeletingProviderId(null)
    }
  }

  async function syncModels() {
    setSyncingModels(true)
    setError(null)

    try {
      const result = await requestJson<{ providerId: string; models: OpenRouterModelSummary[]; exchangeRate: UsdBrlExchangeRate | null }>(
        activeProvider ? `/api/superadmin/ai/models?providerId=${activeProvider.id}` : "/api/superadmin/ai/models",
        { cache: "no-store" }
      )
      setModels(result.models)
      setExchangeRate(result.exchangeRate)
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Erro ao sincronizar modelos.")
    } finally {
      setSyncingModels(false)
    }
  }

  async function saveProfile(profile: AiModelProfile) {
    setSavingProfileId(profile.id)
    setError(null)

    try {
      const updatedProfile = await requestJson<AiModelProfile>(`/api/superadmin/ai/profiles/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify(profile),
      })

      setProfiles((current) => current.map((item) => item.id === profile.id ? updatedProfile : item))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar perfil.")
    } finally {
      setSavingProfileId(null)
    }
  }

  function updateProfile(id: string, updates: Partial<AiModelProfile>) {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...updates } : profile))
  }

  async function toggleGuardrail(guardrail: AiGuardrailRecord, enabled: boolean) {
    setSavingGuardrailId(guardrail.id)
    setError(null)

    try {
      const updated = await requestJson<AiGuardrailRecord>(`/api/superadmin/ai/guardrails/${guardrail.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      })

      setGuardrails((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao atualizar guardrail.")
    } finally {
      setSavingGuardrailId(null)
    }
  }

  const profileOrder: AiModelProfilePurpose[] = ["vision", "image_prompt", "image_generation", "composition_review", "classification", "conversation", "fallback"]
  const orderedProfiles = [...profiles].sort((left, right) => profileOrder.indexOf(left.purpose) - profileOrder.indexOf(right.purpose))
  const compositionProfiles = orderedProfiles.filter(profile => profile.enabled && ["vision", "image_prompt", "image_generation", "composition_review"].includes(profile.purpose))

  return (
    <div ref={dialogContainer} className="flex h-full flex-col bg-background">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[var(--cf-chrome-bg,var(--background))] px-4 py-2 sm:px-8">
        <div className="mr-auto flex flex-col">
          <p className="text-xs leading-tight text-muted-foreground">Núcleo</p>
          <h1 className="text-base font-bold leading-tight text-foreground">IA & Modelos</h1>
        </div>
        <Button size="sm" onClick={() => void syncModels()} disabled={syncingModels}>
          {syncingModels ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Sincronizar modelos
        </Button>
        <Dialog.Root open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
          <Dialog.Trigger asChild>
            <Button asChild variant="outline" size="icon"><button type="button" aria-label="Configurar OpenRouter" title="Configurar OpenRouter"><Settings className="h-4 w-4" /></button></Button>
          </Dialog.Trigger>
          <Dialog.Portal container={dialogContainer.current}>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="font-display text-lg font-semibold">Configuração do OpenRouter</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">Gerencie a conexão, os créditos e as contas do provedor.</Dialog.Description>
                </div>
                <Dialog.Close asChild><Button asChild variant="ghost" size="icon"><button type="button" aria-label="Fechar configuração do OpenRouter"><X className="h-4 w-4" /></button></Button></Dialog.Close>
              </div>
              {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
              <div className="space-y-5">
                <div className="rounded-md border border-border bg-card p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-foreground font-display">Provider OpenRouter</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        A chave fica armazenada somente no servidor.
                      </p>
                    </div>
                    <Bot className="h-5 w-5 text-primary" />
                  </div>

                  <div className="space-y-3">
                    <Field label="Nome">
                      <Input
                        value={newProvider.name}
                        onChange={(event) => setNewProvider((current) => ({ ...current, name: event.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                    <Field label="API key">
                      <Input
                        value={newProvider.apiKey}
                        onChange={(event) => setNewProvider((current) => ({ ...current, apiKey: event.target.value }))}
                        type="password"
                        placeholder="sk-or-..."
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                    <Field label="Base URL">
                      <Input
                        value={newProvider.baseUrl}
                        onChange={(event) => setNewProvider((current) => ({ ...current, baseUrl: event.target.value }))}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                    <Field label="Orcamento mensal em centavos de dolar (USD)">
                      <Input
                        value={newProvider.monthlyBudgetCents}
                        onChange={(event) => setNewProvider((current) => ({ ...current, monthlyBudgetCents: event.target.value }))}
                        inputMode="numeric"
                        placeholder="Ex: 5000 = US$ 50.00"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                    <Field label="Observacoes">
                      <Textarea
                        value={newProvider.notes}
                        onChange={(event) => setNewProvider((current) => ({ ...current, notes: event.target.value }))}
                        className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                  </div>

                  <Button
                    className="mt-4 w-full rounded-md"
                    onClick={() => void createProvider()}
                    disabled={isCreatingProvider || !newProvider.name.trim() || !newProvider.apiKey.trim()}
                  >
                    {isCreatingProvider ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Cadastrar OpenRouter
                  </Button>
                </div>

                <div className="space-y-3">
                  {isLoading ? (
                    <EmptyState title="Carregando IA..." description="Buscando providers e perfis." />
                  ) : providers.length > 0 ? providers.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      testResult={testResults[provider.id]}
                      isTesting={testingProviderId === provider.id}
                      isDeleting={deletingProviderId === provider.id}
                      onTest={() => void testProvider(provider.id)}
                      onDelete={() => void deleteProvider(provider)}
                    />
                  )) : (
                    <EmptyState title="Nenhum provider de IA" description="Cadastre o OpenRouter para habilitar chamadas reais de modelo." />
                  )}
                </div>


              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <UserMenu />
      </header>

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
      <div className="w-full space-y-5 px-4 py-4 sm:px-7">
        <section aria-labelledby="composition-models-title" className="space-y-2">
          <h2 id="composition-models-title" className="font-display text-base font-semibold text-foreground">Modelos ativos</h2>
          {isLoading ? <EmptyState title="Carregando modelos…" description="Buscando as configurações de IA." /> : compositionProfiles.length ? (
            <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {compositionProfiles.map(profile => (
                <li key={profile.id} className="min-w-0 bg-card px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{purposeLabel[profile.purpose]}</p>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Ativo" />
                  </div>
                  <h3 className="mt-1 truncate text-sm font-semibold text-foreground" title={modelsById.get(profile.modelId)?.name || profile.modelId}>{modelsById.get(profile.modelId)?.name || profile.modelId}</h3>
                  {modelsById.get(profile.modelId)?.name && <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground" title={profile.modelId}>{profile.modelId}</p>}
                </li>
              ))}
            </ol>
          ) : <EmptyState title="Nenhum modelo de composição ativo" description="Habilite os perfis nas configurações abaixo." />}
        </section>
        <section aria-labelledby="model-settings-title" className="space-y-4">
          <div>
            <h2 id="model-settings-title" className="font-display text-lg font-semibold text-foreground">Modelos por etapa</h2>
            <p className="mt-1 text-sm text-muted-foreground">Catálogo do OpenRouter filtrado por etapa. Edite em cada linha e salve para aplicar.</p>
            <p className="mt-1 text-xs text-muted-foreground">Entrada e saída em US$ e R$, com a unidade de cobrança. {exchangeRate ? `Conversão de referência: dólar venda BCB de ${exchangeRate.date}, US$ 1 = R$ ${exchangeRate.rate.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}.` : "Conversão em reais indisponível."} Preços variam por provedor e configuração.</p>
          </div>
          <div ref={modelTable} className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <caption className="sr-only">Configurações editáveis dos modelos por etapa</caption>
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Etapa", "Modelo", "Entrada", "Saída", "Contingência", "Temperatura", "Tokens", "Ativo", "Tentativas", "Salvar"].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}{["Entrada", "Saída"].includes(label) && <span className="mt-1 block text-[10px] font-normal">US$ / R$ · por 1 milhão de tokens*</span>}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orderedProfiles.map(profile => {
                  const compatibleModels = models.filter(model => isModelCompatible(model, profile.purpose))
                  const selectedModel = modelsById.get(profile.modelId)
                  const isReviewer = profile.purpose === "composition_review"
                  const generation = profile.purpose === "image_generation"
                  const imageOnly = generation && selectedModel?.imageEndpoint
                  const label = purposeLabel[profile.purpose]
                  const pricesFor = (model: OpenRouterModelSummary) => formatModelPrices({ ...model, imageEndpoint: generation && model.imageEndpoint }, exchangeRate, true)
                  const prices = selectedModel ? pricesFor(selectedModel) : { input: "Não informado", output: "Não informado" }
                  return (
                    <tr key={profile.id} aria-label={label} className="hover:bg-muted/20">
                      <th scope="row" className="w-[15%] whitespace-nowrap px-3 py-3 text-sm font-medium" title={profile.notes}>{label}</th>
                      <td className="max-w-80 px-3 py-3">
                        <ModelPicker label={label} value={profile.modelId} models={compatibleModels} pricesFor={pricesFor} onChange={modelId => updateProfile(profile.id, { modelId })} container={dialogContainer.current} table={modelTable.current} />
                        {selectedModel && !isModelCompatible(selectedModel, profile.purpose) && <span role="alert" className="text-xs text-destructive">Modelo incompatível com esta etapa.</span>}
                      </td>
                      <td className="min-w-44 max-w-56 px-3 py-3 text-xs text-muted-foreground">{prices.input}</td>
                      <td className="min-w-44 max-w-56 px-3 py-3 text-xs text-muted-foreground">{prices.output}</td>
                      <td className="px-3 py-3">
                        {generation ? <span className="whitespace-nowrap text-xs text-muted-foreground" title="As correções usam o modelo selecionado e o limite definido na etapa de avaliação.">Mesmo modelo</span> : <input aria-label={`Contingência — ${label}`} value={profile.fallbackModelIds.join(", ")} onChange={event => updateProfile(profile.id, { fallbackModelIds: event.target.value.split(/,|;/).map(item => item.trim()).filter(Boolean) })} placeholder="Sem contingência" className="h-8 w-full min-w-32 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />}
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" aria-label={`Temperatura — ${label}`} min="0" max="2" step="0.1" disabled={isReviewer || imageOnly} value={isReviewer ? 0 : profile.temperature} onChange={event => updateProfile(profile.id, { temperature: Number(event.target.value) })} title={isReviewer ? "A avaliação usa temperatura zero." : imageOnly ? "Este modelo de imagem não utiliza temperatura." : undefined} className="h-8 w-20 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-3">
                        <input type="number" aria-label={`Tokens — ${label}`} min="1" max="128000" disabled={imageOnly} value={profile.maxTokens} onChange={event => updateProfile(profile.id, { maxTokens: Number(event.target.value) })} title={imageOnly ? "Este modelo de imagem não utiliza limite de tokens." : undefined} className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-3">
                        <input type="checkbox" role="switch" aria-label={`Ativar — ${label}`} checked={profile.enabled} onChange={event => updateProfile(profile.id, { enabled: event.target.checked })} className="h-4 w-4 cursor-pointer accent-primary" />
                      </td>
                      <td className="px-3 py-3">
                        {isReviewer ? <input type="number" aria-label={`Máximo de tentativas — ${label}`} min="1" max="3" step="1" value={profile.maxCompositionAttempts ?? 3} onChange={event => updateProfile(profile.id, { maxCompositionAttempts: Number(event.target.value) })} title="Total de gerações por pedido, incluindo a primeira. Com 1, uma reprovação bloqueia sem gerar novamente." className="h-8 w-20 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" /> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Button asChild variant="outline" size="icon"><button type="button" aria-label={`Salvar — ${label}`} title="Salvar alterações desta etapa" disabled={savingProfileId === profile.id} onClick={() => void saveProfile(profile)}>{savingProfileId === profile.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}</button></Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">* Cobranças por imagem ou megapixel indicam sua unidade junto ao valor. A avaliação ativa compara a foto original, o pedido e o resultado antes da liberação. O limite de tentativas inclui a primeira geração e pode ser definido entre 1 e 3 na avaliação. Com 1, uma reprovação bloqueia sem gerar novamente. Cada geração e avaliação pode ter custo no provedor. Desativá-la libera a imagem sem essa análise.</p>
        </section>
      </div>

      <section className="w-full border-t border-border px-4 py-6 sm:px-7">
        <div className="mb-5">
          <h2 className="font-semibold text-foreground font-display text-lg">Regras de segurança</h2>
          <p className="mt-1 text-sm text-muted-foreground">Regras de segurança aplicadas a todas as chamadas de IA da plataforma.</p>
        </div>
        <ul aria-label="Regras de segurança" className="flex flex-nowrap divide-x divide-border overflow-x-auto rounded-xl border border-border bg-card">
          {guardrails.map((guardrail) => (
            <li key={guardrail.id} className="min-w-64 flex-1"><button
              role="switch"
              aria-checked={guardrail.enabled}
              aria-label={guardrail.label}
              aria-describedby={`guardrail-${guardrail.id}-description`}
              title={guardrail.description}
              type="button"
              onClick={() => void toggleGuardrail(guardrail, !guardrail.enabled)}
              disabled={savingGuardrailId === guardrail.id}
              className="flex w-full items-center justify-between gap-4 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="whitespace-nowrap text-xs font-medium text-foreground">{guardrail.label}</span>
              <span id={`guardrail-${guardrail.id}-description`} className="sr-only">{guardrail.description}</span>
              <span className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", guardrail.enabled ? "bg-primary" : "bg-muted")}>
                <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", guardrail.enabled ? "translate-x-6" : "translate-x-1")} />
              </span>
            </button></li>
          ))}
        </ul>
      </section>
      </div>

    </div>
  )
}

function ModelPicker({ label, value, models, pricesFor, onChange, container, table }: {
  label: string; value: string; models: OpenRouterModelSummary[]
  pricesFor: (model: OpenRouterModelSummary) => { input: string; output: string }
  onChange: (value: string) => void; container: HTMLDivElement | null; table: HTMLDivElement | null
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [height, setHeight] = useState(320)
  const list = useRef<HTMLDivElement>(null)
  const filtered = models.filter(model => `${model.name} ${model.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = models.find(model => model.id === value)
  useEffect(() => { list.current?.children[active]?.scrollIntoView({ block: "nearest" }) }, [active, query])
  const select = (model: OpenRouterModelSummary) => { onChange(model.id); setOpen(false) }
  return <Popover.Root open={open} onOpenChange={next => {
    setOpen(next)
    if (next) { setQuery(""); setActive(Math.max(0, models.findIndex(model => model.id === value))); setHeight(table?.getBoundingClientRect().height || 320) }
  }}>
    <Popover.Trigger asChild><button type="button" role="combobox" aria-label={`Modelo — ${label}`} aria-expanded={open} aria-controls={listId} className="flex h-8 w-full min-w-48 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span className="truncate" title={selected?.id || value}>{selected?.name || value}</span><span aria-hidden="true">⌄</span>
    </button></Popover.Trigger>
    <Popover.Portal container={container}><Popover.Content align="start" sideOffset={4} aria-label={`Escolher modelo — ${label}`} style={{ width: "var(--radix-popover-trigger-width)", maxHeight: `min(${height}px, var(--radix-popover-content-available-height))` }} className="z-50 flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card text-foreground shadow-lg">
      <div className="shrink-0 border-b border-border p-2"><input aria-label={`Buscar modelos — ${label}`} role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActive(0) }} placeholder="Buscar nome ou identificador…" className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))) }
        if (event.key === "Enter" && filtered[active]) { event.preventDefault(); select(filtered[active]) }
      }} /></div>
      <div ref={list} id={listId} role="listbox" aria-label={`Modelos compatíveis — ${label}`} className="min-h-0 overflow-y-auto overscroll-contain p-1">
        {filtered.map((model, index) => {
          const prices = pricesFor(model)
          return <button key={model.id} id={`${listId}-${index}`} role="option" aria-selected={model.id === value} tabIndex={-1} type="button" onMouseMove={() => setActive(index)} onClick={() => select(model)} className={cn("block w-full rounded px-2 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", active === index ? "bg-muted" : "hover:bg-muted/50")}>
            <span className="block break-words font-medium">{model.name}</span>
            <span className="block break-all text-[10px] text-muted-foreground">{model.id}</span>
            <span className="mt-1 block break-words text-[10px] text-muted-foreground">Entrada: {prices.input} · Saída: {prices.output}</span>
          </button>
        })}
        {!filtered.length && <p role="status" className="px-2 py-3 text-xs text-muted-foreground">Nenhum modelo compatível encontrado.</p>}
      </div>
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {Children.map(children, child => isValidElement(child) && (child.type === Input || child.type === Textarea)
        ? cloneElement(child as React.ReactElement<{ "aria-label"?: string }>, { "aria-label": label })
        : child)}
    </label>
  )
}

function ProviderCard({
  provider,
  testResult,
  isTesting,
  isDeleting,
  onTest,
  onDelete,
}: {
  provider: SafeAiProvider
  testResult?: AiProviderTestResult
  isTesting: boolean
  isDeleting: boolean
  onTest: () => void
  onDelete: () => void
}) {
  return (
    <article className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground font-display">{provider.name}</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium uppercase text-primary">OpenRouter</span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium uppercase", provider.health === "ok" ? "bg-primary/10 text-primary" : provider.health === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
              {provider.health}
            </span>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">{provider.baseUrl}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {provider.apiKeyConfigured ? "API key configurada" : "API key ausente"}
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <DatabaseZap className="h-3.5 w-3.5" />
            Creditos: {provider.lastCreditStatus === "available"
              ? `${formatUsd(provider.lastRemainingCreditsUsd)} restantes`
              : provider.lastCreditStatus === "empty"
                ? "sem creditos"
                : "nao consultado"}
          </p>
          {provider.notes && <p className="mt-3 text-sm text-muted-foreground">{provider.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="rounded-md" onClick={onTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
            Testar
          </Button>
          <Button variant="outline" size="sm" className="rounded-md text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
            Excluir
          </Button>
        </div>
      </div>

      {testResult && (
        <div className={cn(
          "mt-4 rounded-md border p-3 text-sm",
          testResult.creditStatus === "unavailable"
            ? "border-warning/20 bg-warning/10 text-warning-ink"
            : testResult.ok
              ? "border-primary/20 bg-primary/5 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive"
        )}>
          <div className="flex items-start gap-2">
            {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="font-bold">
                {testResult.creditStatus === "available"
                  ? "Conexao validada com creditos"
                  : testResult.creditStatus === "empty"
                    ? "Provider sem creditos"
                    : testResult.status === "warning"
                      ? "Conexao validada, saldo indisponivel"
                      : "Falha no OpenRouter"}
              </p>
              <p className="mt-1">{testResult.message}</p>
              {testResult.creditMessage && <p className="mt-1">{testResult.creditMessage}</p>}
              <p className="mt-1 text-xs opacity-75">
                {typeof testResult.latencyMs === "number" ? `${testResult.latencyMs}ms` : "sem latencia"} · {typeof testResult.modelCount === "number" ? `${testResult.modelCount} modelos` : "modelos n/d"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <CreditBox label="Comprado" value={formatUsd(testResult.totalCreditsUsd)} />
                <CreditBox label="Usado" value={formatUsd(testResult.totalUsageUsd)} />
                <CreditBox label="Restante" value={formatUsd(testResult.remainingCreditsUsd)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

function CreditBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-current/15 bg-background/40 px-2 py-1.5">
      <p className="text-xs font-bold uppercase opacity-60">{label}</p>
      <p className="mt-0.5 font-bold">{value}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/50 p-8 text-center">
      <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="font-bold text-foreground font-display">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
