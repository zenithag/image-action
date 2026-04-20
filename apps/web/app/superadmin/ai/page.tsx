"use client"

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
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
  const [newProvider, setNewProvider] = useState(defaultProviderForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingProvider, setIsCreatingProvider] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null)
  const [syncingModels, setSyncingModels] = useState(false)
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, AiProviderTestResult>>({})
  const [error, setError] = useState<string | null>(null)

  const activeProvider = providers.find((provider) => provider.status === "active" && provider.apiKeyConfigured)
  const knownRemainingCreditsUsd = providers.reduce((total, provider) => total + (provider.lastRemainingCreditsUsd ?? 0), 0)
  const modelsById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models])

  async function loadData() {
    setIsLoading(true)
    setError(null)

    try {
      const [providersData, profilesData] = await Promise.all([
        requestJson<SafeAiProvider[]>("/api/superadmin/ai/providers", { cache: "no-store" }),
        requestJson<AiModelProfile[]>("/api/superadmin/ai/profiles", { cache: "no-store" }),
      ])

      setProviders(providersData)
      setProfiles(profilesData)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar IA.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

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

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative z-10 flex items-center justify-between border-b border-border bg-background py-4 pl-6 pr-10">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">IA & Modelos</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Configure o OpenRouter global e escolha modelos por finalidade.
          </p>
        </div>
        <Button className="rounded-[5px] font-sans" onClick={() => void syncModels()} disabled={syncingModels}>
          {syncingModels ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Sincronizar modelos
        </Button>
      </div>

      <section className="grid grid-cols-4 gap-4 border-b border-border bg-card/20 px-6 py-5">
        <MetricCard label="Providers" value={providers.length} icon={Bot} tone="text-primary" />
        <MetricCard label="Provider ativo" value={activeProvider ? "Sim" : "Nao"} icon={ShieldCheck} tone={activeProvider ? "text-primary" : "text-amber-500"} />
        <MetricCard label="Perfis" value={profiles.length} icon={Brain} tone="text-foreground" />
        <MetricCard label="Credito conhecido" value={formatUsd(knownRemainingCreditsUsd)} icon={DatabaseZap} tone="text-sky-500" />
      </section>

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[0.85fr_1.15fr] gap-6 overflow-y-auto p-6 scrollbar-hide">
        <section className="space-y-6">
          <div className="rounded-[5px] border border-border bg-card p-5">
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
                <input
                  value={newProvider.name}
                  onChange={(event) => setNewProvider((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="API key">
                <input
                  value={newProvider.apiKey}
                  onChange={(event) => setNewProvider((current) => ({ ...current, apiKey: event.target.value }))}
                  type="password"
                  placeholder="sk-or-..."
                  className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="Base URL">
                <input
                  value={newProvider.baseUrl}
                  onChange={(event) => setNewProvider((current) => ({ ...current, baseUrl: event.target.value }))}
                  className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="Orcamento mensal em centavos de dolar (USD)">
                <input
                  value={newProvider.monthlyBudgetCents}
                  onChange={(event) => setNewProvider((current) => ({ ...current, monthlyBudgetCents: event.target.value }))}
                  inputMode="numeric"
                  placeholder="Ex: 5000 = US$ 50.00"
                  className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="Observacoes">
                <textarea
                  value={newProvider.notes}
                  onChange={(event) => setNewProvider((current) => ({ ...current, notes: event.target.value }))}
                  className="h-20 w-full resize-none rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
            </div>

            <Button
              className="mt-4 w-full rounded-[5px]"
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
        </section>

        <section className="space-y-4">
          <div className="rounded-[5px] border border-border bg-card p-5">
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

          {profiles.map((profile) => {
            const model = modelsById.get(profile.modelId)

            return (
              <article key={profile.id} className="rounded-[5px] border border-border bg-card p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-foreground font-display">{profile.name}</h3>
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                        {purposeLabel[profile.purpose]}
                      </span>
                      <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", profile.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                        {profile.enabled ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{profile.notes || "Sem observacoes."}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[5px]"
                    onClick={() => void saveProfile(profile)}
                    disabled={savingProfileId === profile.id}
                  >
                    {savingProfileId === profile.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
                    Salvar
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Modelo principal">
                    <input
                      list="openrouter-models"
                      value={profile.modelId}
                      onChange={(event) => updateProfile(profile.id, { modelId: event.target.value })}
                      className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Fallbacks (um por linha ou virgula)">
                    <textarea
                      value={profile.fallbackModelIds.join("\n")}
                      onChange={(event) => updateProfile(profile.id, {
                        fallbackModelIds: event.target.value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
                      })}
                      className="h-20 w-full resize-none rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Temperatura">
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={profile.temperature}
                      onChange={(event) => updateProfile(profile.id, { temperature: Number(event.target.value) })}
                      className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Max tokens">
                    <input
                      type="number"
                      min="1"
                      value={profile.maxTokens}
                      onChange={(event) => updateProfile(profile.id, { maxTokens: Number(event.target.value) })}
                      className="w-full rounded-[5px] border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={profile.enabled}
                    onChange={(event) => updateProfile(profile.id, { enabled: event.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  Perfil habilitado
                </label>

                {model && (
                  <div className="mt-4 rounded-[5px] border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
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
    <div className="flex items-center gap-4 rounded-[5px] border border-border bg-card p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-muted">
        <Icon className={cn("h-5 w-5", tone)} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-foreground font-display">{value}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
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
    <article className="rounded-[5px] border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground font-display">{provider.name}</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase text-primary">OpenRouter</span>
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", provider.health === "ok" ? "bg-primary/10 text-primary" : provider.health === "error" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600")}>
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
          <Button variant="outline" size="sm" className="rounded-[5px]" onClick={onTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-2 h-3.5 w-3.5" />}
            Testar
          </Button>
          <Button variant="outline" size="sm" className="rounded-[5px] text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
            Excluir
          </Button>
        </div>
      </div>

      {testResult && (
        <div className={cn(
          "mt-4 rounded-[5px] border p-3 text-sm",
          testResult.creditStatus === "unavailable"
            ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
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
      <p className="text-[9px] font-bold uppercase opacity-60">{label}</p>
      <p className="mt-0.5 font-bold">{value}</p>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[5px] border border-dashed border-border bg-card/50 p-8 text-center">
      <Bot className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="font-bold text-foreground font-display">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
