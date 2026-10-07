"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { Input, Textarea } from "@/components/spectrum/fields"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  DatabaseZap,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "@/components/spectrum/icons"

import { Button } from "@/components/ui/button"
import type { AiGuardrailRecord } from "@/lib/ai-guardrail-types"
import type {
  AiModelProfile,
  AiModelProfilePurpose,
  AiProviderTestResult,
  OpenRouterModelSummary,
  SafeAiProvider,
} from "@/lib/ai-types"
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
  classification: "Classificacao",
  conversation: "Atendimento",
  vision: "Visao",
  image_prompt: "Prompt de imagem",
  image_generation: "Criacao de imagem",
  fallback: "Fallback",
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

  const activeProvider = providers.find((provider) => provider.status === "active" && provider.apiKeyConfigured)
  const knownRemainingCreditsUsd = providers.reduce((total, provider) => total + (provider.lastRemainingCreditsUsd ?? 0), 0)
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
    if (!activeProvider || models.length > 0 || syncingModels) {
      return
    }

    void syncModels()
  }, [activeProvider?.id])

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
      const result = await requestJson<{ providerId: string; models: OpenRouterModelSummary[] }>(
        activeProvider ? `/api/superadmin/ai/models?providerId=${activeProvider.id}` : "/api/superadmin/ai/models",
        { cache: "no-store" }
      )
      setModels(result.models)
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

  const compositionProfiles = useMemo(
    () => profiles.filter((profile) => profile.purpose === "image_generation" || profile.purpose === "image_prompt" || profile.purpose === "vision"),
    [profiles]
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[var(--cf-chrome-bg,var(--background))] px-4 py-2 sm:px-8">
        <div className="mr-auto flex flex-col">
          <p className="text-xs leading-tight text-muted-foreground">Núcleo</p>
          <h1 className="text-base font-bold leading-tight text-foreground">IA & Modelos</h1>
        </div>
        <Button size="sm" onClick={() => void syncModels()} disabled={syncingModels}>
          {syncingModels ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Sincronizar modelos
        </Button>
        <UserMenu />
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3 px-4 py-4 sm:px-7">
        <MetricCard label="Providers" value={providers.length} icon={Bot} tone="text-primary" />
        <MetricCard label="Provider ativo" value={activeProvider ? "Sim" : "Nao"} icon={ShieldCheck} tone={activeProvider ? "text-primary" : "text-warning"} />
        <MetricCard label="Perfis" value={profiles.length} icon={Brain} tone="text-foreground" />
        <MetricCard label="Credito conhecido" value={formatUsd(knownRemainingCreditsUsd)} icon={DatabaseZap} tone="text-info" />
      </section>

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
      <div className="grid min-w-0 gap-4 px-4 py-6 2xl:grid-cols-[0.85fr_1.15fr] sm:px-7">
        <section className="space-y-6">
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

          <div className="rounded-md border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-foreground font-display">Modelos de composição</h2>
                <p className="mt-1 text-sm text-muted-foreground">Perfis reais usados no pipeline de visão, prompt e geração de imagem.</p>
              </div>
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2.5">
              {compositionProfiles.length > 0 ? compositionProfiles.map((profile) => {
                const model = modelsById.get(profile.modelId)
                const purpose = purposeLabel[profile.purpose]

                return (
                  <div key={profile.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{model?.name || profile.modelId}</p>
                          <p className="text-xs text-muted-foreground">{purpose} · {profile.name}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium uppercase",
                        profile.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {profile.enabled ? "ativo" : "inativo"}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <p>Modelo: <span className="font-medium text-foreground">{profile.modelId}</span></p>
                      <p>Fallbacks: <span className="font-medium text-foreground">{profile.fallbackModelIds.length > 0 ? profile.fallbackModelIds.join(", ") : "nenhum"}</span></p>
                      {model && (
                        <p>Modalidades: <span className="font-medium text-foreground">{model.inputModalities.join(", ") || "n/d"} → {model.outputModalities.join(", ") || "n/d"}</span></p>
                      )}
                    </div>
                  </div>
                )
              }) : (
                <EmptyState title="Sem perfis de composição" description="Crie ou habilite perfis de visão, prompt e geração para o pipeline." />
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-foreground font-display">Perfis de modelo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Troque o modelo por finalidade. Isso muda a IA sem alterar codigo.
                </p>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                OpenRouter
              </span>
            </div>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-2">
          {profiles.map((profile) => {
            const model = modelsById.get(profile.modelId)

            return (
              <article key={profile.id} className="rounded-md border border-border bg-card p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-foreground font-display">{profile.name}</h3>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium uppercase text-muted-foreground">
                        {purposeLabel[profile.purpose]}
                      </span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium uppercase", profile.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {profile.enabled ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.notes || "Sem observacoes."}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-md"
                    onClick={() => void saveProfile(profile)}
                    disabled={savingProfileId === profile.id}
                  >
                    {savingProfileId === profile.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                    Salvar
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Modelo principal">
                    <Input
                      list="openrouter-models"
                      value={profile.modelId}
                      onChange={(event) => updateProfile(profile.id, { modelId: event.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Fallbacks (um por linha ou virgula)">
                    <Textarea
                      value={profile.fallbackModelIds.join("\n")}
                      onChange={(event) => updateProfile(profile.id, {
                        fallbackModelIds: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
                      })}
                      className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Temperatura">
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={profile.temperature}
                      onChange={(event) => updateProfile(profile.id, { temperature: Number(event.target.value) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Max tokens">
                    <Input
                      type="number"
                      min="1"
                      value={profile.maxTokens}
                      onChange={(event) => updateProfile(profile.id, { maxTokens: Number(event.target.value) })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Input
                    type="checkbox"
                    checked={profile.enabled}
                    onChange={(event) => updateProfile(profile.id, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded-md border-border"
                  />
                  Perfil habilitado
                </label>

                {model && (
                  <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="font-bold text-foreground">{model.name}</p>
                    <p className="mt-1">
                      Contexto: {model.contextLength || "n/d"} | Entrada: {model.inputModalities.join(", ") || "n/d"} | Saida: {model.outputModalities.join(", ") || "n/d"}
                    </p>
                    <p className="mt-1">
                      Preco prompt: {model.promptPrice || "n/d"} | completion: {model.completionPrice || "n/d"}
                    </p>
                  </div>
                )}
              </article>
            )
          })}
          </div>
        </section>
      </div>

      <section className="border-t border-border px-7 py-6">
        <div className="mb-5">
          <h2 className="font-bold text-foreground font-display text-lg">Guardrails</h2>
          <p className="mt-1 text-sm text-muted-foreground">Regras de segurança aplicadas a todas as chamadas de IA da plataforma.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {guardrails.map((guardrail) => (
            <button
              key={guardrail.id}
              type="button"
              onClick={() => void toggleGuardrail(guardrail, !guardrail.enabled)}
              disabled={savingGuardrailId === guardrail.id}
              className="flex items-start justify-between gap-4 rounded-md border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{guardrail.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{guardrail.description}</p>
              </div>
              <span className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", guardrail.enabled ? "bg-primary" : "bg-muted")}>
                <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", guardrail.enabled ? "translate-x-6" : "translate-x-1")} />
              </span>
            </button>
          ))}
        </div>
      </section>
      </div>

      <datalist id="openrouter-models">
        {models.map((model) => (
          <option key={model.id} value={model.id}>{model.name}</option>
        ))}
      </datalist>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  tone: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className={cn("h-4 w-4", tone)} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="text-lg font-medium leading-tight text-foreground">{value}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {children}
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground font-display">{provider.name}</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium uppercase text-primary">OpenRouter</span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium uppercase", provider.health === "ok" ? "bg-primary/10 text-primary" : provider.health === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
              {provider.health}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{provider.baseUrl}</p>
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
        <div className="flex gap-2">
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
