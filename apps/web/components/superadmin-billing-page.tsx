"use client"

import { UserMenu } from "@/components/molecules/user-menu"
import { Input, NativeSelect, Textarea } from "@/components/spectrum/fields"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { CheckCircle2, Copy, ExternalLink, Gift, Loader2, Plus, RefreshCw, Save, Ticket, Users, X } from "@/components/spectrum/icons"

import { Button } from "@/components/ui/button"
import { Modal } from "@/components/spectrum/modal"
import type { PlanCatalogEntry, PublicAbacatePaySettings, PublicStripeSettings } from "@/lib/billing-types"
import type { ChannelPlanLimit } from "@/lib/channel-plan-types"
import { defaultChannelPlanLimits } from "@/lib/channel-plan-types"
import type { CreditCoupon, CreditCouponRedemption, ReferralProgramSettings, TenantReferral } from "@/lib/commercial-benefits-types"
import type { TenantPlanCode } from "@/lib/tenant-types"
import { cn } from "@/lib/utils"

const planLabels: Record<string, string> = {
  starter: "Start",
  pro: "Pro",
  enterprise: "Advanced",
  custom: "Personalizado",
}

type CouponsPayload = {
  coupons: CreditCoupon[]
  redemptions: CreditCouponRedemption[]
}

type ReferralsPayload = {
  settings: ReferralProgramSettings
  referrals: TenantReferral[]
}

type PlanDraft = PlanCatalogEntry & {
  quotas: Pick<ChannelPlanLimit, "whatsapp" | "instagram" | "telegram" | "catalogIncluded" | "conversationsLimit" | "extra">
  abacatePayEnabled: boolean
  abacatePayProductId: string
  stripeEnabled: boolean
  stripeProductId: string
  stripePriceId: string
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: "no-store", ...init })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisição inválida."
    throw new Error(message)
  }

  return payload as T
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

export type SuperadminBillingView = "payments" | "plans" | "benefits"

export function SuperadminBillingPage({ view }: { view: SuperadminBillingView }) {
  const [selectedProvider, setSelectedProvider] = useState<"abacatepay" | "stripe">("abacatepay")
  const [settings, setSettings] = useState<PublicAbacatePaySettings | null>(null)
  const [stripeSettings, setStripeSettings] = useState<PublicStripeSettings | null>(null)
  const [planCatalog, setPlanCatalog] = useState<PlanCatalogEntry[]>([])
  const [planLimits, setPlanLimits] = useState<ChannelPlanLimit[]>([])
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null)
  const [couponModalOpen, setCouponModalOpen] = useState(false)
  const [couponsPayload, setCouponsPayload] = useState<CouponsPayload | null>(null)
  const [referralsPayload, setReferralsPayload] = useState<ReferralsPayload | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [stripeSecretKey, setStripeSecretKey] = useState("")
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("")
  const [couponForm, setCouponForm] = useState({
    code: "",
    creditAmount: 25,
    expiresAt: "",
    maxRedemptions: "",
    maxRedemptionsPerTenant: 1,
    notes: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const [abacatePayload, stripePayload, couponsData, referralsData, channelPlans, planCatalogData] = await Promise.all([
        requestJson<PublicAbacatePaySettings>("/api/superadmin/billing/abacatepay"),
        requestJson<PublicStripeSettings>("/api/superadmin/billing/stripe"),
        requestJson<CouponsPayload>("/api/superadmin/billing/coupons"),
        requestJson<ReferralsPayload>("/api/superadmin/billing/referrals"),
        requestJson<ChannelPlanLimit[]>("/api/superadmin/channel-plan-limits"),
        requestJson<PlanCatalogEntry[]>("/api/superadmin/billing/plans"),
      ])
      setSettings(abacatePayload)
      setStripeSettings(stripePayload)
      setPlanCatalog(planCatalogData)
      setPlanLimits(channelPlans)
      setCouponsPayload(couponsData)
      setReferralsPayload(referralsData)
      setApiKey("")
      setStripeSecretKey("")
      setStripeWebhookSecret("")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os pagamentos.")
    } finally {
      setIsLoading(false)
    }
  }

  function openPlanEditor(plan?: PlanCatalogEntry) {
    const code = plan?.planCode ?? ""
    setPlanDraft({
      planCode: code,
      enabled: plan?.enabled ?? false,
      productName: plan?.productName ?? "",
      description: plan?.description ?? "",
      priceCents: plan?.priceCents ?? 0,
      tokensIncluded: plan?.tokensIncluded ?? 0,
      cycle: plan?.cycle ?? "MONTHLY",
      quotas: (() => {
        const saved = planLimits.find((item) => item.planCode === code)
        const fallback = defaultChannelPlanLimits[code as keyof typeof defaultChannelPlanLimits] ?? { whatsapp: 0, instagram: 0, telegram: 0, catalogIncluded: false, conversationsLimit: 0, extra: "Configure os limites deste plano." }
        return {
          whatsapp: saved?.whatsapp ?? fallback.whatsapp,
          instagram: saved?.instagram ?? fallback.instagram,
          telegram: saved?.telegram ?? fallback.telegram,
          catalogIncluded: saved?.catalogIncluded ?? fallback.catalogIncluded,
          conversationsLimit: saved?.conversationsLimit ?? fallback.conversationsLimit,
          extra: saved?.extra ?? fallback.extra,
        }
      })(),
      abacatePayEnabled: settings?.plans[code]?.enabled ?? false,
      abacatePayProductId: settings?.plans[code]?.productId ?? "",
      stripeEnabled: stripeSettings?.plans[code]?.enabled ?? false,
      stripeProductId: stripeSettings?.plans[code]?.productId ?? "",
      stripePriceId: stripeSettings?.plans[code]?.priceId ?? "",
    })
  }

  async function savePlanDraft() {
    if (!planDraft || isSaving) return
    const draft = { ...planDraft, planCode: planDraft.planCode.trim().toLowerCase() }
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(draft.planCode) || !draft.productName.trim()) {
      setError("Informe um código válido e o nome do plano.")
      return
    }
    if ((draft.abacatePayEnabled && (!settings?.enabled || !settings.apiKeyConfigured)) ||
        (draft.stripeEnabled && (!stripeSettings?.enabled || !stripeSettings.secretKeyConfigured))) {
      setError("Configure e habilite os gateways selecionados em Pagamentos antes de salvar o plano.")
      return
    }
    if ((draft.abacatePayEnabled || draft.stripeEnabled) && (draft.priceCents <= 0 || draft.tokensIncluded <= 0)) {
      setError("Informe preço e créditos positivos para conectar o plano aos gateways.")
      return
    }
    const previous = planCatalog.find((plan) => plan.planCode === draft.planCode)
    const changed = previous && (previous.productName !== draft.productName.trim() || previous.description !== draft.description || previous.priceCents !== draft.priceCents || previous.tokensIncluded !== draft.tokensIncluded || previous.cycle !== draft.cycle)
    if (changed) {
      draft.abacatePayProductId = ""
      draft.stripeProductId = ""
      draft.stripePriceId = ""
    }
    setPlanDraft(draft)
    setIsSaving(true)
    setError(null)
    setNotice(null)
    try {
      const exists = planCatalog.some((plan) => plan.planCode === draft.planCode)
      if (!exists) {
        await requestJson<PlanCatalogEntry>("/api/superadmin/billing/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planCode: draft.planCode, productName: draft.productName.trim(), description: draft.description }),
        })
      }
      const nextPlan = { ...draft, productName: draft.productName.trim() }
      const centralPlan: PlanCatalogEntry = {
        planCode: nextPlan.planCode,
        enabled: nextPlan.enabled,
        productName: nextPlan.productName,
        description: nextPlan.description,
        priceCents: nextPlan.priceCents,
        tokensIncluded: nextPlan.tokensIncluded,
        cycle: nextPlan.cycle,
      }
      const nextCatalog = exists
        ? planCatalog.map((plan) => plan.planCode === draft.planCode ? centralPlan : plan)
        : [...planCatalog, centralPlan]
      const plans = await requestJson<PlanCatalogEntry[]>("/api/superadmin/billing/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: nextCatalog }),
      })
      setPlanCatalog(plans)
      const updatedLimits = await requestJson<ChannelPlanLimit[]>("/api/superadmin/channel-plan-limits", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: [{ planCode: draft.planCode, label: draft.productName, ...draft.quotas }] }),
      })
      setPlanLimits(updatedLimits)
      if (settings) {
        const nextSettings = {
          ...settings,
          plans: {
            ...settings.plans,
            [draft.planCode]: {
              ...(settings.plans[draft.planCode] ?? { planCode: draft.planCode, enabled: false, productExternalId: `comofica-${draft.planCode}` }),
              planCode: draft.planCode,
              enabled: draft.abacatePayEnabled,
              productExternalId: changed ? `comofica-${draft.planCode}-${crypto.randomUUID()}` : (settings.plans[draft.planCode]?.productExternalId ?? `comofica-${draft.planCode}`),
              productId: draft.abacatePayProductId.trim() || undefined,
            },
          },
        }
        const saved = await requestJson<PublicAbacatePaySettings>("/api/superadmin/billing/abacatepay", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...nextSettings, apiKey: undefined }),
        })
        setSettings(saved)
        if (draft.abacatePayEnabled && !draft.abacatePayProductId) {
          const created = await requestJson<{ productId: string; settings: PublicAbacatePaySettings }>("/api/superadmin/billing/abacatepay/products", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode: draft.planCode }),
          })
          setSettings(created.settings)
          setPlanDraft((current) => current ? { ...current, abacatePayProductId: created.productId } : current)
        }
      }
      if (stripeSettings) {
        const nextSettings = {
          ...stripeSettings,
          plans: {
            ...stripeSettings.plans,
            [draft.planCode]: {
              ...(stripeSettings.plans[draft.planCode] ?? { planCode: draft.planCode, enabled: false }),
              planCode: draft.planCode,
              enabled: draft.stripeEnabled,
              productId: draft.stripeProductId.trim() || undefined,
              priceId: draft.stripePriceId.trim() || undefined,
            },
          },
        }
        const saved = await requestJson<PublicStripeSettings>("/api/superadmin/billing/stripe", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...nextSettings, secretKey: undefined, webhookSecret: undefined }),
        })
        setStripeSettings(saved)
        if (draft.stripeEnabled && (!draft.stripeProductId || !draft.stripePriceId)) {
          const created = await requestJson<{ productId: string; priceId: string; settings: PublicStripeSettings }>("/api/superadmin/billing/stripe/products", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planCode: draft.planCode }),
          })
          setStripeSettings(created.settings)
          setPlanDraft((current) => current ? { ...current, stripeProductId: created.productId, stripePriceId: created.priceId } : current)
        }
      }
      setPlanDraft(null)
      setNotice(exists ? "Plano atualizado." : "Plano criado e configurado.")
    } catch (saveError) {
      setError(`Não foi possível concluir o salvamento: ${saveError instanceof Error ? saveError.message : "erro inesperado"}. Os dados já salvos foram preservados; tente salvar novamente para concluir os vínculos.`)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  async function saveSettings() {
    if (!settings || isSaving) return

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const payload = await requestJson<PublicAbacatePaySettings>("/api/superadmin/billing/abacatepay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          apiKey: apiKey.trim() || undefined,
        }),
      })
      setSettings(payload)
      setApiKey("")
      setNotice("Configuração da AbacatePay salva.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar os pagamentos.")
    } finally {
      setIsSaving(false)
    }
  }

  async function saveStripeSettings() {
    if (!stripeSettings || isSaving) return

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const payload = await requestJson<PublicStripeSettings>("/api/superadmin/billing/stripe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...stripeSettings,
          secretKey: stripeSecretKey.trim() || undefined,
          webhookSecret: stripeWebhookSecret.trim() || undefined,
        }),
      })
      setStripeSettings(payload)
      setStripeSecretKey("")
      setStripeWebhookSecret("")
      setNotice("Configuração do Stripe salva.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o Stripe.")
    } finally {
      setIsSaving(false)
    }
  }

  async function copyWebhook() {
    if (!settings?.webhookUrl) return
    await navigator.clipboard.writeText(settings.webhookUrl)
    setNotice("URL do webhook copiada.")
  }

  async function copyStripeWebhook() {
    if (!stripeSettings?.webhookUrl) return
    await navigator.clipboard.writeText(stripeSettings.webhookUrl)
    setNotice("URL do webhook Stripe copiada.")
  }

  async function createCoupon() {
    if (isSaving) return

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      await requestJson<CreditCoupon>("/api/superadmin/billing/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...couponForm,
          code: couponForm.code.trim(),
          maxRedemptions: couponForm.maxRedemptions ? Number(couponForm.maxRedemptions) : undefined,
          expiresAt: couponForm.expiresAt || undefined,
        }),
      })
      const couponsData = await requestJson<CouponsPayload>("/api/superadmin/billing/coupons")
      setCouponsPayload(couponsData)
      setCouponForm({
        code: "",
        creditAmount: 25,
        expiresAt: "",
        maxRedemptions: "",
        maxRedemptionsPerTenant: 1,
        notes: "",
      })
      setCouponModalOpen(false)
      setNotice("Cupom criado.")
    } catch (couponError) {
      setError(couponError instanceof Error ? couponError.message : "Não foi possível criar o cupom.")
    } finally {
      setIsSaving(false)
    }
  }

  async function toggleCoupon(coupon: CreditCoupon) {
    setError(null)
    setNotice(null)

    try {
      const updated = await requestJson<CreditCoupon>(`/api/superadmin/billing/coupons/${encodeURIComponent(coupon.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: coupon.status === "active" ? "inactive" : "active" }),
      })
      setCouponsPayload((current) => current ? {
        ...current,
        coupons: current.coupons.map((item) => item.id === updated.id ? updated : item),
      } : current)
      setNotice(updated.status === "active" ? "Cupom ativado." : "Cupom pausado.")
    } catch (couponError) {
      setError(couponError instanceof Error ? couponError.message : "Não foi possível atualizar o cupom.")
    }
  }

  async function saveReferralSettings() {
    if (!referralsPayload || isSaving) return

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const settingsData = await requestJson<ReferralProgramSettings>("/api/superadmin/billing/referrals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(referralsPayload.settings),
      })
      setReferralsPayload({ ...referralsPayload, settings: settingsData })
      setNotice("Programa de indicação salvo.")
    } catch (referralError) {
      setError(referralError instanceof Error ? referralError.message : "Não foi possível salvar o programa de indicação.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b border-border bg-[var(--cf-chrome-bg,var(--background))] px-4 py-2 sm:px-8">
        <div className="mr-auto">
          <p className="text-xs leading-tight text-muted-foreground">Financeiro</p>
          <h1 className="text-base font-bold leading-tight text-foreground">{view === "payments" ? "Pagamentos" : view === "plans" ? "Planos" : "Benefícios"}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadSettings} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
        <UserMenu />
      </header>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="border-b border-primary/20 bg-primary/10 px-6 py-3 text-sm font-medium text-primary">
          {notice}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-hide sm:px-7">
        {isLoading && !settings ? (
          <div className="flex h-full items-center justify-center rounded-md border border-border bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando {view === "payments" ? "pagamentos" : view === "plans" ? "planos" : "benefícios"}...</p>
            </div>
          </div>
        ) : settings && stripeSettings ? (
          <div className="mx-auto max-w-6xl space-y-6">
            {view === "payments" && <section aria-label="Provedores de pagamento" className="grid gap-3 sm:grid-cols-2">
              {([
                { id: "abacatepay", name: "AbacatePay", mark: "abacate.pay", enabled: settings.enabled, configured: settings.apiKeyConfigured },
                { id: "stripe", name: "Stripe", mark: "stripe", enabled: stripeSettings.enabled, configured: stripeSettings.secretKeyConfigured },
              ] as const).map((provider) => (
                <div key={provider.id} className={cn("flex min-h-20 items-center gap-2 rounded-md border bg-card p-3 transition-colors", selectedProvider === provider.id ? "border-primary ring-1 ring-primary/30" : "border-border")}>
                  <button type="button" onClick={() => setSelectedProvider(provider.id)} aria-pressed={selectedProvider === provider.id}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="flex min-w-0 items-center gap-4">
                      <span aria-hidden="true" className={cn("shrink-0 text-xl font-bold tracking-tight", provider.id === "stripe" ? "text-[#635bff]" : "text-green-700")}>{provider.mark}</span>
                      <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">{provider.name}</span><span className="mt-1 block text-xs text-muted-foreground">{provider.configured ? "Credencial configurada" : "Configure as credenciais"}</span></span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", provider.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{provider.enabled ? "Ativo" : "Inativo"}</span>
                  </button>
                </div>
              ))}
            </section>}
      {view === "payments" && selectedProvider === "abacatepay" && settings && (
        <section aria-labelledby="abacate-settings-title" className="rounded-md border border-border bg-card p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Provedor de pagamento</p><h2 id="abacate-settings-title" className="mt-1 text-xl font-semibold">Configurações da AbacatePay</h2><p className="mt-1 text-sm text-muted-foreground">Credenciais, webhooks e URLs gerais do provedor.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex h-11 items-center gap-3 rounded-md border border-input bg-muted/20 px-4 text-sm"><Input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => current ? { ...current, enabled: event.target.checked } : current)} />Habilitar AbacatePay</label>
            <Field label="Base URL da API"><Input value={settings.baseUrl} onChange={(event) => setSettings((current) => current ? { ...current, baseUrl: event.target.value } : current)} /></Field>
            <Field label={settings.apiKeyConfigured ? `API key configurada (${settings.apiKeyPreview})` : "API key"}><Input type="password" value={apiKey} placeholder={settings.apiKeyConfigured ? "Preencha apenas para trocar" : "Cole a API key"} onChange={(event) => setApiKey(event.target.value)} /></Field>
            <Field label="Webhook secret"><Input type="password" value={settings.webhookSecret ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, webhookSecret: event.target.value } : current)} /></Field>
            <Field label="Webhook public key"><Input value={settings.webhookPublicKey ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, webhookPublicKey: event.target.value } : current)} /></Field>
            <Field label="URL de retorno"><Input value={settings.returnUrl ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, returnUrl: event.target.value } : current)} /></Field>
            <Field label="URL de conclusão"><Input value={settings.completionUrl ?? ""} onChange={(event) => setSettings((current) => current ? { ...current, completionUrl: event.target.value } : current)} /></Field>
            <div className="rounded-md border border-border bg-muted/20 p-3 sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Webhook</p><p className="mt-1 break-all text-xs">{settings.webhookUrl || "Salve para gerar a URL."}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void copyWebhook()} disabled={!settings.webhookUrl}><Copy className="mr-2 h-4 w-4" />Copiar URL</Button></div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4"><Button type="button" onClick={() => void saveSettings()} disabled={isSaving}><Save className="mr-2 h-4 w-4" />Salvar AbacatePay</Button></div>
        </section>
      )}

      {view === "payments" && selectedProvider === "stripe" && stripeSettings && (
        <section aria-labelledby="stripe-settings-title" className="rounded-md border border-border bg-card p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Provedor de pagamento</p><h2 id="stripe-settings-title" className="mt-1 text-xl font-semibold">Configurações do Stripe</h2><p className="mt-1 text-sm text-muted-foreground">Credenciais, moeda, retorno e webhook do Stripe Billing.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex h-11 items-center gap-3 rounded-md border border-input bg-muted/20 px-4 text-sm"><Input type="checkbox" checked={stripeSettings.enabled} onChange={(event) => setStripeSettings((current) => current ? { ...current, enabled: event.target.checked } : current)} />Habilitar Stripe</label>
            <Field label="Versão da API"><Input value={stripeSettings.apiVersion} onChange={(event) => setStripeSettings((current) => current ? { ...current, apiVersion: event.target.value } : current)} /></Field>
            <Field label={stripeSettings.secretKeyConfigured ? `Secret key configurada (${stripeSettings.secretKeyPreview})` : "Secret key"}><Input type="password" value={stripeSecretKey} placeholder={stripeSettings.secretKeyConfigured ? "Preencha apenas para trocar" : "Cole a chave sk_…"} onChange={(event) => setStripeSecretKey(event.target.value)} /></Field>
            <Field label={stripeSettings.webhookSecretConfigured ? `Webhook secret (${stripeSettings.webhookSecretPreview})` : "Webhook secret"}><Input type="password" value={stripeWebhookSecret} placeholder={stripeSettings.webhookSecretConfigured ? "Preencha apenas para trocar" : "whsec_…"} onChange={(event) => setStripeWebhookSecret(event.target.value)} /></Field>
            <Field label="Moeda"><Input value={stripeSettings.currency} onChange={(event) => setStripeSettings((current) => current ? { ...current, currency: event.target.value.toLowerCase() } : current)} /></Field>
            <Field label="Success URL"><Input value={stripeSettings.successUrl ?? ""} onChange={(event) => setStripeSettings((current) => current ? { ...current, successUrl: event.target.value } : current)} /></Field>
            <Field label="Cancel URL"><Input value={stripeSettings.cancelUrl ?? ""} onChange={(event) => setStripeSettings((current) => current ? { ...current, cancelUrl: event.target.value } : current)} /></Field>
            <div className="rounded-md border border-border bg-muted/20 p-3 sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Webhook Stripe</p><p className="mt-1 break-all text-xs">{stripeSettings.webhookUrl || "Salve para gerar a URL."}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void copyStripeWebhook()} disabled={!stripeSettings.webhookUrl}><Copy className="mr-2 h-4 w-4" />Copiar URL</Button></div>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4"><Button type="button" onClick={() => void saveStripeSettings()} disabled={isSaving}><Save className="mr-2 h-4 w-4" />Salvar Stripe</Button></div>
        </section>
      )}


            {view === "plans" && <section aria-labelledby="plan-catalog-heading" className="overflow-hidden rounded-md border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                <div>
                  <h2 id="plan-catalog-heading" className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Catálogo de planos</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Cada plano tem um cadastro central e aceita somente os meios de pagamento selecionados.</p>
                </div>
                <Button onClick={() => openPlanEditor()}><Plus className="mr-2 h-4 w-4" />Criar novo plano</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-6 py-3 font-medium">Plano</th><th className="px-4 py-3 font-medium">Preço</th><th className="px-4 py-3 font-medium">Cotas</th><th className="px-4 py-3 font-medium">Meios aceitos</th><th className="px-4 py-3 font-medium">Visibilidade</th><th className="px-6 py-3 text-right font-medium">Ação</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {planCatalog.map((plan) => {
                      const acceptsAbacate = settings.plans[plan.planCode]?.enabled
                      const acceptsStripe = stripeSettings.plans[plan.planCode]?.enabled
                      const quotas = planLimits.find((item) => item.planCode === plan.planCode)
                      const cycleLabel = { WEEKLY: "semana", MONTHLY: "mês", SEMIANNUALLY: "semestre", ANNUALLY: "ano" }[plan.cycle]
                      return (
                        <tr key={plan.planCode} tabIndex={0} onClick={() => openPlanEditor(plan)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPlanEditor(plan) } }} className="cursor-pointer transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          <td className="px-6 py-4"><span className="block font-semibold text-foreground">{plan.productName}</span><span className="mt-1 block text-xs text-muted-foreground">{plan.planCode} · {plan.cycle === "MONTHLY" ? "Mensal" : plan.cycle === "ANNUALLY" ? "Anual" : plan.cycle === "SEMIANNUALLY" ? "Semestral" : "Semanal"}</span></td>
                          <td className="px-4 py-4 font-medium">{plan.priceCents > 0 ? `${formatMoney(plan.priceCents)} / ${cycleLabel}` : "Sob consulta"}</td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">{quotas ? `WhatsApp ${quotas.whatsapp} · Instagram ${quotas.instagram} · Telegram ${quotas.telegram}` : "Configure no plano"}<span className="mt-1 block">{quotas?.conversationsLimit ?? 0} conversas{quotas?.catalogIncluded ? " · Catálogo" : ""}</span></td>
                          <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{acceptsAbacate && <span className="rounded-full bg-green-700/10 px-2.5 py-1 text-xs font-medium text-green-800">AbacatePay</span>}{acceptsStripe && <span className="rounded-full bg-[#635bff]/10 px-2.5 py-1 text-xs font-medium text-[#5145cd]">Stripe</span>}{!acceptsAbacate && !acceptsStripe && <span className="text-xs text-muted-foreground">Nenhum configurado</span>}</div></td>
                          <td className="px-4 py-4"><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", plan.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{plan.enabled ? "Público" : "Oculto"}</span></td>
                          <td className="px-6 py-4 text-right"><Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); openPlanEditor(plan) }}>Editar</Button></td>
                        </tr>
                      )
                    })}
                    {planCatalog.length === 0 && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhum plano cadastrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>}

            {view === "benefits" && <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-md border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" />
                    <div>
                      <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Cupons de créditos</h2>
                      <p className="mt-1 text-xs text-muted-foreground">Crie cupons e acompanhe o uso na lista.</p>
                    </div>
                  </div>
                  <Button type="button" onClick={() => setCouponModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Criar cupom</Button>
                </div>
                <div className="divide-y divide-border border-t border-border">
                  {couponsPayload?.coupons.length ? couponsPayload.coupons.map((coupon) => {
                    const uses = couponsPayload.redemptions.filter((redemption) => redemption.couponId === coupon.id).length
                    return (
                      <div key={coupon.id} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_120px_120px_auto] md:items-center">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{coupon.code}</p>
                          <p className="text-xs text-muted-foreground">{coupon.notes || "Sem observação"}</p>
                        </div>
                        <div className="text-sm text-foreground">{coupon.creditAmount} créditos</div>
                        <div className="text-sm text-muted-foreground">{uses}{coupon.maxRedemptions ? `/${coupon.maxRedemptions}` : ""} usos</div>
                        <Button variant="outline" size="sm" onClick={() => void toggleCoupon(coupon)}>
                          {coupon.status === "active" ? "Pausar" : "Ativar"}
                        </Button>
                      </div>
                    )
                  }) : (
                    <div className="px-6 py-8 text-sm text-muted-foreground">Nenhum cupom criado ainda.</div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Programa de indicação</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Indicação convertida gera bônus único de créditos para quem indicou.</p>
                  </div>
                </div>
                {referralsPayload ? (
                  <div className="space-y-4 p-6">
                    <label className="flex h-11 items-center gap-3 rounded-md border border-input bg-muted/20 px-4 text-sm">
                      <Input
                        type="checkbox"
                        checked={referralsPayload.settings.enabled}
                        onChange={(event) => setReferralsPayload((current) => current ? {
                          ...current,
                          settings: { ...current.settings, enabled: event.target.checked },
                        } : current)}
                      />
                      <span>Programa ativo</span>
                    </label>
                    <Field label="Créditos por indicação convertida">
                      <Input
                        type="number"
                        min={1}
                        value={referralsPayload.settings.defaultCreditAmount}
                        onChange={(event) => setReferralsPayload((current) => current ? {
                          ...current,
                          settings: { ...current.settings, defaultCreditAmount: Number(event.target.value) },
                        } : current)}
                        className="h-10 w-full rounded-md border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                    <Button onClick={saveReferralSettings} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar indicações
                    </Button>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <ReferralMetric label="Pendentes" value={referralsPayload.referrals.filter((item) => item.status === "pending" && item.referredTenantSlug).length} />
                      <ReferralMetric label="Convertidas" value={referralsPayload.referrals.filter((item) => item.status === "converted").length} />
                      <ReferralMetric label="Créditos" value={referralsPayload.referrals.reduce((total, item) => total + item.creditsGranted, 0)} />
                    </div>
                    <div className="divide-y divide-border rounded-md border border-border">
                      {referralsPayload.referrals.slice(0, 6).map((referral) => (
                        <div key={referral.id} className="px-4 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{referral.referrerTenantSlug}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase text-muted-foreground">{referral.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            indicado: {referral.referredTenantSlug || "link disponível"} · créditos: {referral.creditsGranted}
                          </p>
                        </div>
                      ))}
                      {referralsPayload.referrals.length === 0 && (
                        <div className="px-4 py-6 text-sm text-muted-foreground">Nenhuma indicação registrada ainda.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>}

            {view === "payments" && <div className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <ExternalLink className="h-4 w-4 text-primary" />
                Próximo uso
              </div>
              <p>
                Depois de configurar a chave e os produtos, abra o perfil de um tenant e gere o link de checkout da assinatura no bloco de faturamento.
              </p>
            </div>}
          </div>
        ) : null}
      </div>
      {view === "plans" && planDraft && (() => {
        const savedPlan = planCatalog.find((plan) => plan.planCode === planDraft.planCode)
        return (
          <Modal onClose={() => setPlanDraft(null)} aria-labelledby="plan-editor-title" className="w-full max-w-3xl p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Catálogo central</p><h2 id="plan-editor-title" className="mt-1 text-xl font-semibold text-foreground">{savedPlan ? "Editar plano" : "Criar novo plano"}</h2><p className="mt-1 text-sm text-muted-foreground">Defina os dados comerciais e os meios aceitos por este plano.</p></div>
              <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={() => setPlanDraft(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo / código único"><Input value={planDraft.planCode} disabled={Boolean(savedPlan)} onChange={(event) => setPlanDraft((current) => current ? { ...current, planCode: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") } : current)} placeholder="business-plus" /></Field>
              <Field label="Nome do plano"><Input value={planDraft.productName} onChange={(event) => setPlanDraft((current) => current ? { ...current, productName: event.target.value } : current)} placeholder="Business Plus" /></Field>
              <div className="sm:col-span-2"><Field label="Descrição"><Textarea rows={2} value={planDraft.description} onChange={(event) => setPlanDraft((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Para equipes em crescimento" /></Field></div>
              <Field label="Preço (R$)"><Input type="number" min="0" step="0.01" value={(planDraft.priceCents / 100).toFixed(2)} onChange={(event) => setPlanDraft((current) => current ? { ...current, priceCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) } : current)} /></Field>
              <Field label="Créditos por ciclo"><Input type="number" min="0" step="1" value={planDraft.tokensIncluded} onChange={(event) => setPlanDraft((current) => current ? { ...current, tokensIncluded: Math.max(0, Math.round(Number(event.target.value || 0))) } : current)} /></Field>
              <Field label="Ciclo de cobrança"><NativeSelect value={planDraft.cycle} onChange={(event) => setPlanDraft((current) => current ? { ...current, cycle: event.target.value as PlanCatalogEntry["cycle"] } : current)}><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensal</option><option value="SEMIANNUALLY">Semestral</option><option value="ANNUALLY">Anual</option></NativeSelect></Field>
              <label className="flex h-11 items-center gap-3 self-end rounded-md border border-border px-3 text-sm"><Input type="checkbox" checked={planDraft.enabled} onChange={(event) => setPlanDraft((current) => current ? { ...current, enabled: event.target.checked } : current)} />Exibir na página pública</label>
            </div>
            <section className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold">Cotas e limites</h3>
              <p className="mt-1 text-xs text-muted-foreground">Defina os limites incluídos em cada assinatura deste plano.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(["whatsapp", "instagram", "telegram", "conversationsLimit"] as const).map((key) => (
                  <Field key={key} label={{ whatsapp: "Instâncias de WhatsApp", instagram: "Instâncias de Instagram", telegram: "Instâncias de Telegram", conversationsLimit: "Conversas por ciclo" }[key]}>
                    <Input type="number" min="0" step="1" value={planDraft.quotas[key]} onChange={(event) => setPlanDraft((current) => current ? { ...current, quotas: { ...current.quotas, [key]: Math.max(0, Math.round(Number(event.target.value || 0))) } } : current)} />
                  </Field>
                ))}
                <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-border px-3 text-sm"><Input type="checkbox" checked={planDraft.quotas.catalogIncluded} onChange={(event) => setPlanDraft((current) => current ? { ...current, quotas: { ...current.quotas, catalogIncluded: event.target.checked } } : current)} />Incluir catálogo</label>
                <div className="sm:col-span-2 lg:col-span-3"><Field label="Observação sobre os limites"><Input value={planDraft.quotas.extra} onChange={(event) => setPlanDraft((current) => current ? { ...current, quotas: { ...current.quotas, extra: event.target.value } } : current)} placeholder="Regras e limites adicionais" /></Field></div>
              </div>
            </section>
            <section className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold">Meios de pagamento aceitos</h3>
              <p className="mt-1 text-xs text-muted-foreground">Os identificadores conectam produtos já existentes. Para criar novos produtos, salve o plano primeiro.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground">Ao salvar, o produto será criado automaticamente quando necessário. Os identificadores ficam armazenados pelo sistema.</p>
                  <label className="flex items-center gap-2 text-sm font-medium"><Input type="checkbox" checked={planDraft.abacatePayEnabled} onChange={(event) => setPlanDraft((current) => current ? { ...current, abacatePayEnabled: event.target.checked } : current)} />Aceitar AbacatePay <span className="text-xs font-normal text-muted-foreground">{settings?.enabled && settings.apiKeyConfigured ? "conectada" : "não configurada"}</span></label>
                </div>
                <div className="space-y-3 rounded-md border border-border bg-muted/10 p-4">
                  <p className="text-xs text-muted-foreground">Ao salvar, o produto será criado automaticamente quando necessário. Os identificadores ficam armazenados pelo sistema.</p>
                  <label className="flex items-center gap-2 text-sm font-medium"><Input type="checkbox" checked={planDraft.stripeEnabled} onChange={(event) => setPlanDraft((current) => current ? { ...current, stripeEnabled: event.target.checked } : current)} />Aceitar Stripe <span className="text-xs font-normal text-muted-foreground">{stripeSettings?.enabled && stripeSettings.secretKeyConfigured ? "conectado" : "não configurado"}</span></label>
                </div>
              </div>
            </section>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={() => setPlanDraft(null)}>Cancelar</Button><Button type="button" onClick={() => void savePlanDraft()} disabled={isSaving || !planDraft.planCode || !planDraft.productName.trim()}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{savedPlan ? "Salvar alterações" : "Criar plano"}</Button></div>
          </Modal>
        )
      })()}

      {view === "benefits" && couponModalOpen && (
        <Modal onClose={() => setCouponModalOpen(false)} aria-labelledby="coupon-editor-title" className="w-full max-w-xl p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Créditos</p><h2 id="coupon-editor-title" className="mt-1 text-xl font-semibold text-foreground">Criar cupom</h2><p className="mt-1 text-sm text-muted-foreground">Configure o código, os créditos e os limites de resgate.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={() => setCouponModalOpen(false)}><X className="h-4 w-4" /></Button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código do cupom"><Input value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="BEMVINDO" /></Field>
            <Field label="Créditos"><Input type="number" min="1" step="1" value={couponForm.creditAmount} onChange={(event) => setCouponForm((current) => ({ ...current, creditAmount: Math.max(1, Math.round(Number(event.target.value || 1))) }))} /></Field>
            <Field label="Expira em"><Input type="date" value={couponForm.expiresAt} onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))} /></Field>
            <Field label="Limite total de usos"><Input type="number" min="1" step="1" value={couponForm.maxRedemptions} onChange={(event) => setCouponForm((current) => ({ ...current, maxRedemptions: event.target.value }))} placeholder="Sem limite" /></Field>
            <Field label="Usos por tenant"><Input type="number" min="1" step="1" value={couponForm.maxRedemptionsPerTenant} onChange={(event) => setCouponForm((current) => ({ ...current, maxRedemptionsPerTenant: Math.max(1, Math.round(Number(event.target.value || 1))) }))} /></Field>
            <div className="sm:col-span-2"><Field label="Observação"><Textarea rows={2} value={couponForm.notes} onChange={(event) => setCouponForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Uso interno ou campanha" /></Field></div>
          </div>
          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={() => setCouponModalOpen(false)}>Cancelar</Button><Button type="button" onClick={() => void createCoupon()} disabled={isSaving || !couponForm.code.trim() || couponForm.creditAmount < 1}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}Criar cupom</Button></div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function ReferralMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
