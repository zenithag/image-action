"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { CheckCircle2, Copy, CreditCard, ExternalLink, Gift, Loader2, PackagePlus, RefreshCw, Save, Ticket, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PublicAbacatePaySettings, PublicStripeSettings } from "@/lib/billing-types"
import type { CreditCoupon, CreditCouponRedemption, ReferralProgramSettings, TenantReferral } from "@/lib/commercial-benefits-types"
import type { TenantPlanCode } from "@/lib/tenant-types"
import { cn } from "@/lib/utils"

const planLabels: Record<TenantPlanCode, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

const planCodes: TenantPlanCode[] = ["starter", "pro", "enterprise"]

type CouponsPayload = {
  coupons: CreditCoupon[]
  redemptions: CreditCouponRedemption[]
}

type ReferralsPayload = {
  settings: ReferralProgramSettings
  referrals: TenantReferral[]
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

export default function SuperadminBillingPage() {
  const [settings, setSettings] = useState<PublicAbacatePaySettings | null>(null)
  const [stripeSettings, setStripeSettings] = useState<PublicStripeSettings | null>(null)
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
  const [creatingProduct, setCreatingProduct] = useState<TenantPlanCode | null>(null)
  const [creatingStripeProduct, setCreatingStripeProduct] = useState<TenantPlanCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const [abacatePayload, stripePayload, couponsData, referralsData] = await Promise.all([
        requestJson<PublicAbacatePaySettings>("/api/superadmin/billing/abacatepay"),
        requestJson<PublicStripeSettings>("/api/superadmin/billing/stripe"),
        requestJson<CouponsPayload>("/api/superadmin/billing/coupons"),
        requestJson<ReferralsPayload>("/api/superadmin/billing/referrals"),
      ])
      setSettings(abacatePayload)
      setStripeSettings(stripePayload)
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

  async function createPlanProduct(planCode: TenantPlanCode) {
    if (!settings || creatingProduct) return

    setCreatingProduct(planCode)
    setError(null)
    setNotice(null)

    try {
      const payload = await requestJson<{ productId: string; settings: PublicAbacatePaySettings }>("/api/superadmin/billing/abacatepay/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      })
      setSettings(payload.settings)
      setNotice(`Produto ${planLabels[planCode]} criado na AbacatePay.`)
    } catch (productError) {
      setError(productError instanceof Error ? productError.message : "Não foi possível criar o produto.")
    } finally {
      setCreatingProduct(null)
    }
  }

  async function createStripePlanProduct(planCode: TenantPlanCode) {
    if (!stripeSettings || creatingStripeProduct) return

    setCreatingStripeProduct(planCode)
    setError(null)
    setNotice(null)

    try {
      const payload = await requestJson<{ productId: string; priceId: string; settings: PublicStripeSettings }>("/api/superadmin/billing/stripe/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      })
      setStripeSettings(payload.settings)
      setNotice(`Produto e preço ${planLabels[planCode]} criados no Stripe.`)
    } catch (productError) {
      setError(productError instanceof Error ? productError.message : "Não foi possível criar produto/preço no Stripe.")
    } finally {
      setCreatingStripeProduct(null)
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

  function updatePlan(planCode: TenantPlanCode, patch: Partial<PublicAbacatePaySettings["plans"][TenantPlanCode]>) {
    setSettings((current) => current ? {
      ...current,
      plans: {
        ...current.plans,
        [planCode]: {
          ...current.plans[planCode],
          ...patch,
        },
      },
    } : current)
  }

  function updateStripePlan(planCode: TenantPlanCode, patch: Partial<PublicStripeSettings["plans"][TenantPlanCode]>) {
    setStripeSettings((current) => current ? {
      ...current,
      plans: {
        ...current.plans,
        [planCode]: {
          ...current.plans[planCode],
          ...patch,
        },
      },
    } : current)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background px-7">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Financeiro</p>
          <h1 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">Pagamentos</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadSettings} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

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

      <div className="flex-1 overflow-y-auto px-7 py-6 scrollbar-hide">
        {isLoading && !settings ? (
          <div className="flex h-full items-center justify-center rounded-[10px] border border-border bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando AbacatePay...</p>
            </div>
          </div>
        ) : settings && stripeSettings ? (
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="rounded-[10px] border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <CreditCard className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Provider AbacatePay</h2>
              </div>
              <div className="grid gap-4 p-6 md:grid-cols-2">
                <label className="flex h-11 items-center gap-3 rounded-[10px] border border-input bg-muted/20 px-4 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(event) => setSettings((current) => current ? { ...current, enabled: event.target.checked } : current)}
                  />
                  <span>Habilitar pagamentos por AbacatePay</span>
                </label>
                <Field label="Base URL da API">
                  <input
                    value={settings.baseUrl}
                    onChange={(event) => setSettings((current) => current ? { ...current, baseUrl: event.target.value } : current)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label={settings.apiKeyConfigured ? `API key configurada (${settings.apiKeyPreview})` : "API key"}>
                  <input
                    type="password"
                    value={apiKey}
                    placeholder={settings.apiKeyConfigured ? "Preencha apenas para trocar" : "Cole a API key da AbacatePay"}
                    onChange={(event) => setApiKey(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="Webhook secret">
                  <input
                    value={settings.webhookSecret ?? ""}
                    onChange={(event) => setSettings((current) => current ? { ...current, webhookSecret: event.target.value } : current)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="Webhook public key (opcional)">
                  <input
                    value={settings.webhookPublicKey ?? ""}
                    onChange={(event) => setSettings((current) => current ? { ...current, webhookPublicKey: event.target.value } : current)}
                    placeholder="Use se habilitar validação HMAC"
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="URL de retorno">
                  <input
                    value={settings.returnUrl ?? ""}
                    onChange={(event) => setSettings((current) => current ? { ...current, returnUrl: event.target.value } : current)}
                    placeholder="https://comofica.ai/obrigado"
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="URL de conclusão">
                  <input
                    value={settings.completionUrl ?? ""}
                    onChange={(event) => setSettings((current) => current ? { ...current, completionUrl: event.target.value } : current)}
                    placeholder="https://comofica.ai/assinatura/concluida"
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <div className="rounded-[10px] border border-border bg-muted/20 p-4 md:col-span-2">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Webhook</p>
                      <p className="mt-1 break-all font-mono text-xs text-foreground">{settings.webhookUrl || "Salve para gerar a URL."}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyWebhook} disabled={!settings.webhookUrl}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end border-t border-border px-6 py-4">
                <Button onClick={saveSettings} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar AbacatePay
                </Button>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                <CreditCard className="h-4 w-4 text-primary" />
                <div>
                  <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Provider Stripe</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Fallback opcional para checkout recorrente via Stripe Billing.</p>
                </div>
              </div>
              <div className="grid gap-4 p-6 md:grid-cols-2">
                <label className="flex h-11 items-center gap-3 rounded-[10px] border border-input bg-muted/20 px-4 text-sm">
                  <input
                    type="checkbox"
                    checked={stripeSettings.enabled}
                    onChange={(event) => setStripeSettings((current) => current ? { ...current, enabled: event.target.checked } : current)}
                  />
                  <span>Habilitar Stripe como fallback</span>
                </label>
                <Field label="Versão da API">
                  <input
                    value={stripeSettings.apiVersion}
                    onChange={(event) => setStripeSettings((current) => current ? { ...current, apiVersion: event.target.value } : current)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label={stripeSettings.secretKeyConfigured ? `Secret key configurada (${stripeSettings.secretKeyPreview})` : "Secret key"}>
                  <input
                    type="password"
                    value={stripeSecretKey}
                    placeholder={stripeSettings.secretKeyConfigured ? "Preencha apenas para trocar" : "Cole a sk_live ou sk_test"}
                    onChange={(event) => setStripeSecretKey(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label={stripeSettings.webhookSecretConfigured ? `Webhook secret (${stripeSettings.webhookSecretPreview})` : "Webhook secret"}>
                  <input
                    type="password"
                    value={stripeWebhookSecret}
                    placeholder={stripeSettings.webhookSecretConfigured ? "Preencha apenas para trocar" : "whsec_..."}
                    onChange={(event) => setStripeWebhookSecret(event.target.value)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="Moeda">
                  <input
                    value={stripeSettings.currency}
                    onChange={(event) => setStripeSettings((current) => current ? { ...current, currency: event.target.value.toLowerCase() } : current)}
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="Success URL">
                  <input
                    value={stripeSettings.successUrl ?? ""}
                    onChange={(event) => setStripeSettings((current) => current ? { ...current, successUrl: event.target.value } : current)}
                    placeholder="https://comofica.ai/assinatura/sucesso"
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <Field label="Cancel URL">
                  <input
                    value={stripeSettings.cancelUrl ?? ""}
                    onChange={(event) => setStripeSettings((current) => current ? { ...current, cancelUrl: event.target.value } : current)}
                    placeholder="https://comofica.ai/assinatura/cancelada"
                    className="h-11 w-full rounded-[10px] border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </Field>
                <div className="rounded-[10px] border border-border bg-muted/20 p-4 md:col-span-2">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Webhook Stripe</p>
                      <p className="mt-1 break-all font-mono text-xs text-foreground">{stripeSettings.webhookUrl || "Salve para gerar a URL."}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyStripeWebhook} disabled={!stripeSettings.webhookUrl}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end border-t border-border px-6 py-4">
                <Button onClick={saveStripeSettings} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Stripe
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {planCodes.map((planCode) => {
                const plan = settings.plans[planCode]
                return (
                  <div key={planCode} className="rounded-[10px] border border-border bg-card p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Plano</p>
                        <h3 className="font-display text-lg font-bold text-foreground">{planLabels[planCode]}</h3>
                      </div>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase", plan.productId ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                        {plan.productId ? "produto ok" : "sem produto"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <Field label="Nome">
                        <input value={plan.productName} onChange={(event) => updatePlan(planCode, { productName: event.target.value })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <Field label="Descrição">
                        <textarea value={plan.description} rows={3} onChange={(event) => updatePlan(planCode, { description: event.target.value })} className="w-full rounded-[10px] border border-input bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Preço em centavos">
                          <input type="number" value={plan.priceCents} onChange={(event) => updatePlan(planCode, { priceCents: Number(event.target.value) })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </Field>
                        <Field label="Tokens">
                          <input type="number" value={plan.tokensIncluded} onChange={(event) => updatePlan(planCode, { tokensIncluded: Number(event.target.value) })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Ciclo">
                          <select value={plan.cycle} onChange={(event) => updatePlan(planCode, { cycle: event.target.value as typeof plan.cycle })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="WEEKLY">Semanal</option>
                            <option value="MONTHLY">Mensal</option>
                            <option value="SEMIANNUALLY">Semestral</option>
                            <option value="ANNUALLY">Anual</option>
                          </select>
                        </Field>
                        <Field label="Valor">
                          <div className="flex h-10 items-center rounded-[10px] border border-border bg-muted/20 px-3 text-sm font-semibold">
                            {formatMoney(plan.priceCents)}
                          </div>
                        </Field>
                      </div>
                      <Field label="Product ID">
                        <input value={plan.productId ?? ""} onChange={(event) => updatePlan(planCode, { productId: event.target.value || undefined })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <div className="grid gap-2">
                        <Button variant="outline" onClick={() => void createPlanProduct(planCode)} disabled={creatingProduct === planCode || !settings.enabled}>
                          {creatingProduct === planCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                          Criar produto recorrente
                        </Button>
                        {plan.productId ? (
                          <div className="flex items-center gap-2 text-xs font-medium text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Product ID pronto para checkouts.
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Salve o provider e crie o produto, ou cole um productId existente.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {planCodes.map((planCode) => {
                const plan = stripeSettings.plans[planCode]
                return (
                  <div key={planCode} className="rounded-[10px] border border-border bg-card p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Stripe fallback</p>
                        <h3 className="font-display text-lg font-bold text-foreground">{planLabels[planCode]}</h3>
                      </div>
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase", plan.priceId ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                        {plan.priceId ? "price ok" : "sem price"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <Field label="Nome">
                        <input value={plan.productName} onChange={(event) => updateStripePlan(planCode, { productName: event.target.value })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <Field label="Descrição">
                        <textarea value={plan.description} rows={3} onChange={(event) => updateStripePlan(planCode, { description: event.target.value })} className="w-full rounded-[10px] border border-input bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Preço em centavos">
                          <input type="number" value={plan.priceCents} onChange={(event) => updateStripePlan(planCode, { priceCents: Number(event.target.value) })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </Field>
                        <Field label="Tokens">
                          <input type="number" value={plan.tokensIncluded} onChange={(event) => updateStripePlan(planCode, { tokensIncluded: Number(event.target.value) })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Intervalo">
                          <select value={plan.interval} onChange={(event) => updateStripePlan(planCode, { interval: event.target.value as typeof plan.interval })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                            <option value="day">Diário</option>
                            <option value="week">Semanal</option>
                            <option value="month">Mensal</option>
                            <option value="year">Anual</option>
                          </select>
                        </Field>
                        <Field label="Valor">
                          <div className="flex h-10 items-center rounded-[10px] border border-border bg-muted/20 px-3 text-sm font-semibold">
                            {formatMoney(plan.priceCents)}
                          </div>
                        </Field>
                      </div>
                      <Field label="Product ID">
                        <input value={plan.productId ?? ""} onChange={(event) => updateStripePlan(planCode, { productId: event.target.value || undefined })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <Field label="Price ID">
                        <input value={plan.priceId ?? ""} onChange={(event) => updateStripePlan(planCode, { priceId: event.target.value || undefined })} className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                      </Field>
                      <div className="grid gap-2">
                        <Button variant="outline" onClick={() => void createStripePlanProduct(planCode)} disabled={creatingStripeProduct === planCode || !stripeSettings.enabled}>
                          {creatingStripeProduct === planCode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                          Criar Product + Price
                        </Button>
                        {plan.priceId ? (
                          <div className="flex items-center gap-2 text-xs font-medium text-primary">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Price ID pronto para checkouts Stripe.
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Crie Product/Price ou cole IDs existentes do Stripe.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[10px] border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Ticket className="h-4 w-4 text-primary" />
                  <div>
                    <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Cupons de créditos</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Cupons adicionam créditos de composição ao tenant.</p>
                  </div>
                </div>
                <div className="grid gap-4 p-6 md:grid-cols-2">
                  <Field label="Código">
                    <input
                      value={couponForm.code}
                      onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                      placeholder="BONUS25"
                      className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Créditos">
                    <input
                      type="number"
                      min={1}
                      value={couponForm.creditAmount}
                      onChange={(event) => setCouponForm((current) => ({ ...current, creditAmount: Number(event.target.value) }))}
                      className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Validade">
                    <input
                      type="datetime-local"
                      value={couponForm.expiresAt}
                      onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))}
                      className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Limite total">
                    <input
                      type="number"
                      min={0}
                      value={couponForm.maxRedemptions}
                      onChange={(event) => setCouponForm((current) => ({ ...current, maxRedemptions: event.target.value }))}
                      placeholder="Sem limite"
                      className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Usos por tenant">
                    <input
                      type="number"
                      min={1}
                      value={couponForm.maxRedemptionsPerTenant}
                      onChange={(event) => setCouponForm((current) => ({ ...current, maxRedemptionsPerTenant: Number(event.target.value) }))}
                      className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Observação">
                    <input
                      value={couponForm.notes}
                      onChange={(event) => setCouponForm((current) => ({ ...current, notes: event.target.value }))}
                      className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Button onClick={createCoupon} disabled={isSaving || !couponForm.code.trim()}>
                      <Gift className="mr-2 h-4 w-4" />
                      Criar cupom
                    </Button>
                  </div>
                </div>
                <div className="divide-y divide-border border-t border-border">
                  {couponsPayload?.coupons.length ? couponsPayload.coupons.slice(0, 8).map((coupon) => {
                    const uses = couponsPayload.redemptions.filter((redemption) => redemption.couponId === coupon.id).length
                    return (
                      <div key={coupon.id} className="grid gap-3 px-6 py-4 md:grid-cols-[1fr_120px_120px_auto] md:items-center">
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">{coupon.code}</p>
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

              <div className="rounded-[10px] border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Programa de indicação</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Indicação convertida gera bônus único de créditos para quem indicou.</p>
                  </div>
                </div>
                {referralsPayload ? (
                  <div className="space-y-4 p-6">
                    <label className="flex h-11 items-center gap-3 rounded-[10px] border border-input bg-muted/20 px-4 text-sm">
                      <input
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
                      <input
                        type="number"
                        min={1}
                        value={referralsPayload.settings.defaultCreditAmount}
                        onChange={(event) => setReferralsPayload((current) => current ? {
                          ...current,
                          settings: { ...current.settings, defaultCreditAmount: Number(event.target.value) },
                        } : current)}
                        className="h-10 w-full rounded-[10px] border border-input bg-muted/20 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <div className="divide-y divide-border rounded-[10px] border border-border">
                      {referralsPayload.referrals.slice(0, 6).map((referral) => (
                        <div key={referral.id} className="px-4 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{referral.referrerTenantSlug}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] uppercase text-muted-foreground">{referral.status}</span>
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
            </div>

            <div className="rounded-[10px] border border-border bg-card p-5 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <ExternalLink className="h-4 w-4 text-primary" />
                Próximo uso
              </div>
              <p>
                Depois de configurar a chave e os produtos, abra o perfil de um tenant e gere o link de checkout da assinatura no bloco de faturamento.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function ReferralMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] border border-border bg-muted/20 p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
