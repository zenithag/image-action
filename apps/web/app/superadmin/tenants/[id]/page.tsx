"use client"

import { TenantNicheSelect } from "@/components/tenant-niche-select"
import { Input, NativeSelect, Textarea } from "@/components/spectrum/fields"
import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Calendar,
  Copy,
  CreditCard,
  Database,
  Coins,
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Save,
  Shield,
  Trash2,
  Users,
  Workflow,
} from "@/components/spectrum/icons"

import { Button } from "@/components/ui/button"
import type { PlanCatalogEntry, PublicAbacatePaySettings, PublicStripeSettings, TenantBillingSubscription } from "@/lib/billing-types"
import type { TenantTokenSnapshot } from "@/lib/token-ledger-types"
import type { Tenant, TenantBusinessVertical, TenantPlanCode, TenantStatus } from "@/lib/tenant-types"
import type { TenantSettings } from "@/lib/tenant-settings-types"
import { cn } from "@/lib/utils"

const statusConfig: Record<TenantStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-primary/20 text-primary" },
  suspended: { label: "Suspenso", className: "bg-destructive/20 text-destructive" },
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  archived: { label: "Arquivado", className: "bg-muted text-muted-foreground" },
}

const planLabels: Partial<Record<TenantPlanCode, string>> = {
  starter: "Start",
  pro: "Pro",
  enterprise: "Advanced",
  custom: "Personalizado",
}

const verticalLabels: Record<TenantBusinessVertical, string> = {
  generic: "Generico",
  decor: "Decoracao",
  fashion: "Moda",
  automotive: "Automotivo",
  furniture: "Moveis",
}

type TenantFormState = {
  name: string
  status: TenantStatus
  planCode: TenantPlanCode
  businessVertical: TenantBusinessVertical
  contactEmail: string
  contactName: string
  phone: string
  customPlan?: Tenant["customPlan"]
}

type AbacateBillingPayload = {
  settings: PublicAbacatePaySettings
  subscription: TenantBillingSubscription | null
}

type StripeBillingPayload = {
  settings: PublicStripeSettings
  subscription: TenantBillingSubscription | null
}

type CheckoutFormState = {
  name: string
  email: string
  taxId: string
  cellphone: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatMoney(cents?: number) {
  if (typeof cents !== "number") return "n/d"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
}

function toLines(values: string[]) {
  return values.join("\n")
}

function fromLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildTenantForm(tenant: Tenant): TenantFormState {
  return {
    name: tenant.name,
    status: tenant.status,
    planCode: tenant.planCode,
    businessVertical: tenant.businessVertical,
    contactEmail: tenant.contactEmail ?? "",
    contactName: tenant.contactName ?? "",
    phone: tenant.phone ?? "",
    customPlan: tenant.customPlan,
  }
}

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenantForm, setTenantForm] = useState<TenantFormState | null>(null)
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [tokenSnapshot, setTokenSnapshot] = useState<TenantTokenSnapshot | null>(null)
  const [abacateBilling, setAbacateBilling] = useState<AbacateBillingPayload | null>(null)
  const [stripeBilling, setStripeBilling] = useState<StripeBillingPayload | null>(null)
  const [planCatalog, setPlanCatalog] = useState<PlanCatalogEntry[]>([])
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormState>({
    name: "",
    email: "",
    taxId: "",
    cellphone: "",
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingTenant, setIsSavingTenant] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSavingCatalogAccess, setIsSavingCatalogAccess] = useState(false)
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    async function loadTenantContext() {
      setIsLoading(true)
      setError(null)

      try {
        const [tenantResponse, settingsResponse, tokenResponse, billingResponse, stripeResponse, plansResponse] = await Promise.all([
          fetch(`/api/superadmin/tenants/${encodeURIComponent(params.id)}`, { cache: "no-store" }),
          fetch(`/api/superadmin/tenants/${encodeURIComponent(params.id)}/settings`, { cache: "no-store" }),
          fetch(`/api/superadmin/tenants/${encodeURIComponent(params.id)}/billing/tokens`, { cache: "no-store" }),
          fetch(`/api/superadmin/tenants/${encodeURIComponent(params.id)}/billing/abacatepay`, { cache: "no-store" }),
          fetch(`/api/superadmin/tenants/${encodeURIComponent(params.id)}/billing/stripe`, { cache: "no-store" }),
          fetch("/api/superadmin/billing/plans", { cache: "no-store" }),
        ])
        const tenantData = await tenantResponse.json()
        const settingsData = await settingsResponse.json()
        const tokenData = await tokenResponse.json()
        const billingData = await billingResponse.json()
        const stripeData = await stripeResponse.json()
        const plansData = await plansResponse.json()

        if (!tenantResponse.ok) {
          throw new Error(tenantData?.error || "Tenant nao encontrado.")
        }

        if (!settingsResponse.ok) {
          throw new Error(settingsData?.error || "Nao foi possivel carregar as configuracoes do cliente.")
        }

        if (!tokenResponse.ok) {
          throw new Error(tokenData?.error || "Nao foi possivel carregar os tokens do cliente.")
        }

        if (!billingResponse.ok) {
          throw new Error(billingData?.error || "Nao foi possivel carregar a assinatura do cliente.")
        }

        if (!stripeResponse.ok) {
          throw new Error(stripeData?.error || "Nao foi possivel carregar o fallback Stripe.")
        }
        if (!plansResponse.ok || !Array.isArray(plansData)) throw new Error("Não foi possível carregar os planos.")

        const nextTenant = tenantData as Tenant
        setTenant(nextTenant)
        setTenantForm(buildTenantForm(nextTenant))
        setSettings(settingsData as TenantSettings)
        setTokenSnapshot(tokenData as TenantTokenSnapshot)
        setAbacateBilling(billingData as AbacateBillingPayload)
        setStripeBilling(stripeData as StripeBillingPayload)
        setPlanCatalog(plansData as PlanCatalogEntry[])
        setCheckoutForm({
          name: nextTenant.contactName || nextTenant.name,
          email: nextTenant.contactEmail || "",
          taxId: "",
          cellphone: nextTenant.phone || "",
        })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Tenant nao encontrado.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadTenantContext()
  }, [params.id])

  async function removeTenant() {
    if (!tenant || !window.confirm(`Remover o cliente "${tenant.name}"?`)) {
      return
    }

    const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}`, {
      method: "DELETE",
    })

    if (response.ok) {
      router.replace("/superadmin")
      router.refresh()
      return
    }

    const data = await response.json()
    setError(data?.error || "Nao foi possivel remover o cliente.")
  }

  async function saveTenantProfile() {
    if (!tenant || !tenantForm || isSavingTenant) return

    setIsSavingTenant(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantForm),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel salvar o cliente.")
      }

      const updatedTenant = data as Tenant
      setTenant(updatedTenant)
      setTenantForm(buildTenantForm(updatedTenant))
      const settingsResponse = await fetch(`/api/superadmin/tenants/${encodeURIComponent(updatedTenant.id)}/settings`, { cache: "no-store" })
      if (!settingsResponse.ok) throw new Error("Cadastro salvo; não foi possível atualizar o acesso ao catálogo. Recarregue a página.")
      setSettings(await settingsResponse.json())
      setNotice("Cadastro do cliente atualizado.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar o cliente.")
    } finally {
      setIsSavingTenant(false)
    }
  }

  async function saveSegmentationSettings() {
    if (!tenant || !settings || isSavingSettings) return

    setIsSavingSettings(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmentation: settings.segmentation,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel salvar as configuracoes de segmentacao.")
      }

      setSettings(data as TenantSettings)
      setNotice("Configuracoes de segmentacao atualizadas.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar as configuracoes de segmentacao.")
    } finally {
      setIsSavingSettings(false)
    }
  }

  async function saveCatalogAccess(enabled: boolean) {
    if (!tenant || !settings || isSavingCatalogAccess) return
    setIsSavingCatalogAccess(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio: { catalogEnabled: enabled } }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Não foi possível alterar o acesso ao catálogo.")
      setSettings(data as TenantSettings)
      setNotice(enabled ? "Catálogo liberado para esta conta." : "Catálogo desativado para esta conta.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível alterar o acesso ao catálogo.")
    } finally {
      setIsSavingCatalogAccess(false)
    }
  }

  async function createAbacateCheckout() {
    if (!tenant || !tenantForm || !abacateBilling || isCreatingCheckout) return

    setIsCreatingCheckout(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}/billing/abacatepay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutForm,
          planCode: tenantForm.planCode,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel gerar o checkout da assinatura.")
      }

      const subscription = data.subscription as TenantBillingSubscription
      setAbacateBilling({
        ...abacateBilling,
        subscription,
      })

      if (subscription.checkoutUrl) {
        await navigator.clipboard.writeText(subscription.checkoutUrl).catch(() => undefined)
      }

      setNotice("Checkout de assinatura criado.")
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Nao foi possivel gerar o checkout da assinatura.")
    } finally {
      setIsCreatingCheckout(false)
    }
  }

  async function createStripeCheckout() {
    if (!tenant || !tenantForm || !stripeBilling || isCreatingCheckout) return

    setIsCreatingCheckout(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch(`/api/superadmin/tenants/${encodeURIComponent(tenant.id)}/billing/stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutForm,
          planCode: tenantForm.planCode,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel gerar o checkout Stripe.")
      }

      const subscription = data.subscription as TenantBillingSubscription
      setStripeBilling({
        ...stripeBilling,
        subscription,
      })

      if (subscription.checkoutUrl) {
        await navigator.clipboard.writeText(subscription.checkoutUrl).catch(() => undefined)
      }

      setNotice("Checkout Stripe criado.")
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Nao foi possivel gerar o checkout Stripe.")
    } finally {
      setIsCreatingCheckout(false)
    }
  }

  async function copyCheckoutLink() {
    const url = abacateBilling?.subscription?.checkoutUrl

    if (!url) return

    await navigator.clipboard.writeText(url)
    setNotice("Link de checkout copiado.")
  }

  async function copyStripeCheckoutLink() {
    const url = stripeBilling?.subscription?.checkoutUrl

    if (!url) return

    await navigator.clipboard.writeText(url)
    setNotice("Link de checkout Stripe copiado.")
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando cliente...</p>
        </div>
      </div>
    )
  }

  if (!tenant || !tenantForm || !settings) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-4 border-b border-border bg-background py-4 pl-6 pr-10">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md hover:bg-muted" asChild>
            <Link href="/superadmin">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Tenant nao encontrado</h1>
            <p className="text-sm text-muted-foreground">{error || "Esse cliente nao existe no cadastro real."}</p>
          </div>
        </div>
      </div>
    )
  }

  const hasUnsavedPlan = tenantForm.planCode !== tenant.planCode || JSON.stringify(tenantForm.customPlan) !== JSON.stringify(tenant.customPlan)
  const status = statusConfig[tenant.status]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-background px-7">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-muted" asChild>
          <Link href="/superadmin">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white"
          style={{ background: `hsl(${(tenant.name.charCodeAt(0) * 37) % 360}, 55%, 50%)` }}
        >
          {tenant.name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="font-display truncate text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">{tenant.name}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium uppercase", status.className)}>
              {status.label}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">{tenant.slug}.comofica.ai</p>
        </div>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void removeTenant()}>
          <Trash2 className="mr-2 h-4 w-4" /> Remover
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

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-md border border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
                  <div>
                    <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Catálogo nesta conta</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Liberar acesso ao catálogo nesta conta. O plano também precisa incluir o recurso.</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Input type="checkbox" checked={settings.studio.catalogEnabled} disabled={isSavingCatalogAccess || !(settings as TenantSettings & { catalogAccess?: { included?: boolean } }).catalogAccess?.included} onChange={(event) => void saveCatalogAccess(event.target.checked)} />
                    Liberado
                  </label>
                </div>
                {!(settings as TenantSettings & { catalogAccess?: { included?: boolean } }).catalogAccess?.included && <p className="px-6 pt-3 text-xs text-muted-foreground">O plano atual não inclui catálogo. Habilite-o na configuração dos planos para liberar este cliente.</p>}
              </div>
              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Shield className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Cadastro do cliente</h2>
                </div>
                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <Field label="Nome da empresa">
                    <Input value={tenantForm.name} onChange={(event) => setTenantForm((current) => current ? { ...current, name: event.target.value } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </Field>
                  <Field label="Email principal">
                    <Input value={tenantForm.contactEmail} onChange={(event) => setTenantForm((current) => current ? { ...current, contactEmail: event.target.value } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </Field>
                  <Field label="Responsavel">
                    <Input value={tenantForm.contactName} onChange={(event) => setTenantForm((current) => current ? { ...current, contactName: event.target.value } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </Field>
                  <Field label="Telefone">
                    <Input value={tenantForm.phone} onChange={(event) => setTenantForm((current) => current ? { ...current, phone: event.target.value } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </Field>
                  <Field label="Plano">
                    <NativeSelect value={tenantForm.planCode} onChange={(event) => setTenantForm((current) => current ? { ...current, planCode: event.target.value as TenantPlanCode } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {planCatalog.map((plan) => <option key={plan.planCode} value={plan.planCode}>{plan.productName}</option>)}
                    </NativeSelect>
                  </Field>
                  {tenantForm.planCode === "custom" && <>
                    <Field label="Assinatura mensal personalizada (R$)">
                      <Input type="number" min={0} step="0.01" value={(tenantForm.customPlan?.priceCents ?? 0) / 100} onChange={event => setTenantForm(current => current ? { ...current, customPlan: { tokensIncluded: current.customPlan?.tokensIncluded ?? 0, priceCents: Math.round(Number(event.target.value) * 100) } } : current)} />
                    </Field>
                    <Field label="Tokens por pagamento mensal">
                      <Input type="number" min={0} step={1} value={tenantForm.customPlan?.tokensIncluded ?? 0} onChange={event => setTenantForm(current => current ? { ...current, customPlan: { priceCents: current.customPlan?.priceCents ?? 0, tokensIncluded: Number(event.target.value) } } : current)} />
                    </Field>
                    <p className="text-xs text-muted-foreground sm:col-span-2">Valores exclusivos deste cliente. Salve antes de gerar o checkout; o saldo será creditado após o pagamento. Assinaturas existentes mantêm o contrato anterior.</p>
                  </>}
                  <Field label="Status">
                    <NativeSelect value={tenantForm.status} onChange={(event) => setTenantForm((current) => current ? { ...current, status: event.target.value as TenantStatus } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="active">Ativo</option>
                      <option value="draft">Rascunho</option>
                      <option value="suspended">Suspenso</option>
                      <option value="archived">Arquivado</option>
                    </NativeSelect>
                  </Field>
                  <Field label="Nicho do cliente">
                    <TenantNicheSelect value={tenantForm.businessVertical} onChange={value => setTenantForm(current => current ? { ...current, businessVertical: value } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm" />
                  </Field>
                </div>
                <div className="flex justify-end border-t border-border px-6 py-4">
                  <Button onClick={() => void saveTenantProfile()} disabled={isSavingTenant}>
                    {isSavingTenant ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar cadastro
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Workflow className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Configuracoes de segmentacao</h2>
                </div>
                <div className="grid gap-4 p-6 sm:grid-cols-2">
                  <Field label="Perfil de segmentacao">
                    <TenantNicheSelect value={settings.segmentation.profile} onChange={value => setSettings(current => current ? { ...current, segmentation: { ...current.segmentation, profile: value } } : current)} className="h-11 w-full rounded-md border border-input bg-muted/20 px-4 text-sm" />
                  </Field>
                  <Field label="Delegacao futura ao tenant">
                    <label className="flex h-11 items-center gap-3 rounded-md border border-input bg-muted/20 px-4 text-sm">
                      <Input
                        type="checkbox"
                        checked={settings.segmentation.tenantCanManage}
                        onChange={(event) => setSettings((current) => current ? {
                          ...current,
                          segmentation: { ...current.segmentation, tenantCanManage: event.target.checked },
                        } : current)}
                      />
                      <span>Permitir que o cliente edite depois</span>
                    </label>
                  </Field>
                  <Field label="Targets editaveis">
                    <Textarea
                      rows={6}
                      value={toLines(settings.segmentation.editableTargets)}
                      onChange={(event) => setSettings((current) => current ? {
                        ...current,
                        segmentation: { ...current.segmentation, editableTargets: fromLines(event.target.value) },
                      } : current)}
                      className="w-full rounded-md border border-input bg-muted/20 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Targets protegidos">
                    <Textarea
                      rows={6}
                      value={toLines(settings.segmentation.protectedTargets)}
                      onChange={(event) => setSettings((current) => current ? {
                        ...current,
                        segmentation: { ...current.segmentation, protectedTargets: fromLines(event.target.value) },
                      } : current)}
                      className="w-full rounded-md border border-input bg-muted/20 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </Field>
                  <Field label="Hints de prompt por nicho">
                    <Textarea
                      rows={5}
                      value={toLines(settings.segmentation.promptHints)}
                      onChange={(event) => setSettings((current) => current ? {
                        ...current,
                        segmentation: { ...current.segmentation, promptHints: fromLines(event.target.value) },
                      } : current)}
                      className="w-full rounded-md border border-input bg-muted/20 px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary sm:col-span-2"
                    />
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
                  <p className="text-sm text-muted-foreground">
                    Por enquanto essas configuracoes ficam restritas ao Super Admin.
                  </p>
                  <Button onClick={() => void saveSegmentationSettings()} disabled={isSavingSettings}>
                    {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar segmentacao
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Conversas" value={tenant.stats.conversations} icon={MessageSquare} />
                <StatCard label="Composicoes" value={tenant.stats.compositions} icon={Database} />
                <StatCard label="Contatos" value={tenant.stats.contacts} icon={Users} />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-md border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border px-6 py-4">
                  <Mail className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground">Resumo atual</h2>
                </div>
                <div className="grid gap-6 p-6">
                  <InfoItem label="Email principal" value={tenant.contactEmail || "Nao configurado"} />
                  <InfoItem label="Plano atual" value={planCatalog.find((plan) => plan.planCode === tenant.planCode)?.productName ?? planLabels[tenant.planCode] ?? tenant.planCode} />
                  <InfoItem label="Nicho" value={verticalLabels[tenant.businessVertical] ?? tenant.businessVertical} />
                  <InfoItem icon={Calendar} label="Data de criacao" value={formatDate(tenant.createdAt)} />
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-6">
                <div className="mb-5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Assinatura AbacatePay</h3>
                </div>
                {abacateBilling ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-border bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium uppercase text-muted-foreground">Provider</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase", abacateBilling.settings.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                          {abacateBilling.settings.enabled ? "habilitado" : "desabilitado"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Status</span>
                          <span className="font-medium">{abacateBilling.subscription?.status ?? "sem assinatura"}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Plano</span>
                          <span className="font-medium">{planCatalog.find((plan) => plan.planCode === (abacateBilling.subscription?.planCode ?? tenant.planCode))?.productName ?? planLabels[abacateBilling.subscription?.planCode ?? tenant.planCode] ?? (abacateBilling.subscription?.planCode ?? tenant.planCode)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Valor</span>
                          <span className="font-medium">{formatMoney(abacateBilling.subscription?.amountCents ?? (tenant.planCode === "custom" ? tenant.customPlan?.priceCents : undefined) ?? planCatalog.find((plan) => plan.planCode === tenant.planCode)?.priceCents)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <Field label="Nome no checkout">
                        <Input
                          value={checkoutForm.name}
                          onChange={(event) => setCheckoutForm((current) => ({ ...current, name: event.target.value }))}
                          className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </Field>
                      <Field label="Email de cobrança">
                        <Input
                          type="email"
                          value={checkoutForm.email}
                          onChange={(event) => setCheckoutForm((current) => ({ ...current, email: event.target.value }))}
                          className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="CPF/CNPJ">
                          <Input
                            value={checkoutForm.taxId}
                            onChange={(event) => setCheckoutForm((current) => ({ ...current, taxId: event.target.value }))}
                            className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </Field>
                        <Field label="Telefone">
                          <Input
                            value={checkoutForm.cellphone}
                            onChange={(event) => setCheckoutForm((current) => ({ ...current, cellphone: event.target.value }))}
                            className="h-11 w-full rounded-md border border-input bg-background px-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </Field>
                      </div>
                    </div>

                    <Button className="w-full" onClick={() => void createAbacateCheckout()} disabled={isCreatingCheckout || hasUnsavedPlan || !abacateBilling.settings.enabled}>
                      {isCreatingCheckout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                      Gerar checkout
                    </Button>

                    {abacateBilling.subscription?.checkoutUrl ? (
                      <div className="grid gap-2">
                        <Button variant="outline" className="w-full" onClick={() => void copyCheckoutLink()}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar checkout
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <a href={abacateBilling.subscription.checkoutUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Abrir checkout
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nao foi possivel carregar a assinatura deste cliente.</p>
                )}
              </div>

              <div className="rounded-md border border-border bg-card p-6">
                <div className="mb-5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="font-display text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Fallback Stripe</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Use apenas quando quiser enviar checkout alternativo ao AbacatePay.</p>
                  </div>
                </div>
                {stripeBilling ? (
                  <div className="space-y-4">
                    <div className="rounded-md border border-border bg-muted/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium uppercase text-muted-foreground">Provider</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase", stripeBilling.settings.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                          {stripeBilling.settings.enabled ? "fallback ativo" : "desabilitado"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Status</span>
                          <span className="font-medium">{stripeBilling.subscription?.status ?? "sem checkout Stripe"}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Plano</span>
                          <span className="font-medium">{planCatalog.find((plan) => plan.planCode === (stripeBilling.subscription?.planCode ?? tenant.planCode))?.productName ?? planLabels[stripeBilling.subscription?.planCode ?? tenant.planCode] ?? (stripeBilling.subscription?.planCode ?? tenant.planCode)}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">Valor</span>
                          <span className="font-medium">{formatMoney(stripeBilling.subscription?.amountCents ?? (tenant.planCode === "custom" ? tenant.customPlan?.priceCents : undefined) ?? planCatalog.find((plan) => plan.planCode === tenant.planCode)?.priceCents)}</span>
                        </div>
                      </div>
                    </div>

                    <Button className="w-full" variant="outline" onClick={() => void createStripeCheckout()} disabled={isCreatingCheckout || hasUnsavedPlan || !stripeBilling.settings.enabled}>
                      {isCreatingCheckout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                      Gerar checkout Stripe
                    </Button>

                    {stripeBilling.subscription?.checkoutUrl ? (
                      <div className="grid gap-2">
                        <Button variant="outline" className="w-full" onClick={() => void copyStripeCheckoutLink()}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar checkout Stripe
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <a href={stripeBilling.subscription.checkoutUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Abrir checkout Stripe
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nao foi possivel carregar o fallback Stripe deste cliente.</p>
                )}
              </div>

              <div className="rounded-md border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Tokens da loja</h3>
                </div>
                {tokenSnapshot ? (
                  <div className="space-y-6">
                    {tokenSnapshot.isExhausted ? (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                        O cliente está sem tokens. Novas composições já ficam bloqueadas até a confirmação de um novo pagamento.
                      </div>
                    ) : tokenSnapshot.isLowBalance ? (
                      <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-warning-ink">
                        Saldo em alerta: restam {tokenSnapshot.account.balance} tokens, abaixo do limiar de {tokenSnapshot.account.lowBalanceThreshold}.
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <TokenMetric label="Saldo atual" value={String(tokenSnapshot.account.balance)} highlight />
                      <TokenMetric label="Incluidos" value={String(tokenSnapshot.account.includedTokens)} />
                      <TokenMetric label="Consumidos" value={String(tokenSnapshot.account.consumedTokens)} />
                      <TokenMetric label="Excedente" value={String(tokenSnapshot.account.overageTokens)} tone={tokenSnapshot.account.overageTokens > 0 ? "warning" : "default"} />
                    </div>

                    <p className="text-sm text-muted-foreground">Créditos são liberados após a confirmação do pagamento. Alterar a cota contratada não adiciona saldo.</p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Historico recente</p>
                        <span className="text-xs text-muted-foreground">
                          limiar baixo: {tokenSnapshot.account.lowBalanceThreshold}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {tokenSnapshot.entries.slice(0, 5).map((entry) => (
                          <div key={entry.id} className="rounded-md border border-border px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium text-foreground">{entry.description}</span>
                              <span className={cn(" text-xs", entry.amount >= 0 ? "text-primary" : "text-foreground")}>
                                {entry.amount >= 0 ? "+" : ""}{entry.amount}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span>{formatDate(entry.createdAt)}</span>
                              <span>Saldo apos: {entry.balanceAfter}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nao foi possivel carregar o saldo deste cliente.</p>
                )}
              </div>

              <div className="rounded-md border border-border bg-card p-6">
                <div className="mb-6 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Estado do cadastro</h3>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">ID</span>
                    <span className="truncate text-xs">{tenant.id}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Slug</span>
                    <span className="text-xs">{tenant.slug}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Perfil de segmentacao</span>
                    <span className="text-right text-xs">{verticalLabels[settings.segmentation.profile] ?? settings.segmentation.profile}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Atualizado</span>
                    <span className="text-right text-xs">{formatDate(tenant.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-card p-6">
                <h3 className="font-display text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Governanca</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  O cliente continua usando o mesmo conjunto de configuracoes persistidas, mas a edicao da parte de segmentacao esta centralizada aqui no Super Admin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TokenMetric({
  label,
  value,
  highlight = false,
  tone = "default",
}: {
  label: string
  value: string
  highlight?: boolean
  tone?: "default" | "warning"
}) {
  return (
    <div className={cn("rounded-md border border-border px-4 py-3", highlight ? "bg-primary/10" : "bg-muted/10")}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-bold", tone === "warning" ? "text-warning" : "text-foreground")}>
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Mail
  label: string
  value: string
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 text-sm font-medium">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary/60" /> : null}
        {value}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Users
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
