import type {
  AbacatePayCycle,
  AbacatePayPlanConfig,
  AbacatePaySettings,
  AbacatePayWebhookEventRecord,
  BillingProvider,
  PlanCatalogEntry,
  PublicAbacatePaySettings,
  PublicStripeSettings,
  StripeInterval,
  StripePlanConfig,
  StripeSettings,
  TenantBillingStatus,
  TenantBillingSubscription,
} from "@/lib/billing-types"
import type { BuiltInTenantPlanCode, Tenant, TenantPlanCode } from "@/lib/tenant-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type BillingData = {
  planCatalog: Record<TenantPlanCode, PlanCatalogEntry>
  abacatePay: AbacatePaySettings
  stripe: StripeSettings
  subscriptions: TenantBillingSubscription[]
  webhookEvents: AbacatePayWebhookEventRecord[]
}

const dataFile = getRuntimeDataFile("billing.json")
const storeKey = "billing"
const builtInPlanCodes: BuiltInTenantPlanCode[] = ["starter", "pro", "enterprise", "custom"]
const cycles = new Set<AbacatePayCycle>(["WEEKLY", "MONTHLY", "SEMIANNUALLY", "ANNUALLY"])
const stripeIntervals = new Set<StripeInterval>(["day", "week", "month", "year"])
const statuses = new Set<TenantBillingStatus>(["none", "checkout_pending", "active", "cancelled", "past_due", "failed"])

let mutationQueue = Promise.resolve()

const defaultPlanCatalog: Record<BuiltInTenantPlanCode, PlanCatalogEntry> = {
  starter: { planCode: "starter", enabled: true, productName: "ComoFica Starter", description: "Plano inicial ComoFica com 100 créditos mensais de composição.", priceCents: 9700, tokensIncluded: 100, cycle: "MONTHLY" },
  pro: { planCode: "pro", enabled: true, productName: "ComoFica Pro", description: "Plano profissional ComoFica com 500 créditos mensais de composição.", priceCents: 29700, tokensIncluded: 500, cycle: "MONTHLY" },
  enterprise: { planCode: "enterprise", enabled: true, productName: "ComoFica Enterprise", description: "Plano enterprise ComoFica com 2000 créditos mensais de composição.", priceCents: 99700, tokensIncluded: 2000, cycle: "MONTHLY" },
  custom: { planCode: "custom", enabled: false, productName: "ComoFica Personalizado", description: "Plano personalizado ComoFica com limites definidos por cliente.", priceCents: 0, tokensIncluded: 0, cycle: "MONTHLY" },
}

const defaultAbacatePayPlans: Record<BuiltInTenantPlanCode, AbacatePayPlanConfig> = {
  starter: { planCode: "starter", enabled: true, productExternalId: "comofica-starter-monthly" },
  pro: { planCode: "pro", enabled: true, productExternalId: "comofica-pro-monthly" },
  enterprise: { planCode: "enterprise", enabled: true, productExternalId: "comofica-enterprise-monthly" },
  custom: { planCode: "custom", enabled: false, productExternalId: "comofica-personalizado-monthly" },
}

const defaultStripePlans: Record<BuiltInTenantPlanCode, StripePlanConfig> = {
  starter: { planCode: "starter", enabled: true },
  pro: { planCode: "pro", enabled: true },
  enterprise: { planCode: "enterprise", enabled: true },
  custom: { planCode: "custom", enabled: false },
}

function now() {
  return new Date().toISOString()
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizePlanCode(value: unknown): TenantPlanCode {
  const code = normalizeText(value).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return code || "starter"
}

function normalizeCycle(value: unknown, fallback: AbacatePayCycle): AbacatePayCycle {
  return cycles.has(value as AbacatePayCycle) ? value as AbacatePayCycle : fallback
}

function normalizeStripeInterval(value: unknown, fallback: StripeInterval): StripeInterval {
  return stripeIntervals.has(value as StripeInterval) ? value as StripeInterval : fallback
}

function buildDefaultSettings(): AbacatePaySettings {
  const timestamp = now()

  return {
    enabled: false,
    baseUrl: "https://api.abacatepay.com/v2",
    webhookSecret: crypto.randomUUID().replaceAll("-", ""),
    devMode: false,
    plans: defaultAbacatePayPlans,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function buildDefaultStripeSettings(): StripeSettings {
  const timestamp = now()

  return {
    enabled: false,
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() || undefined,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
    apiVersion: "2026-02-25.clover",
    currency: "brl",
    plans: defaultStripePlans,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function normalizeAbacatePayPlanLink(value: unknown, fallback: AbacatePayPlanConfig): AbacatePayPlanConfig {
  const plan = value as Partial<AbacatePayPlanConfig> | null
  return {
    planCode: fallback.planCode,
    enabled: normalizeBoolean(plan?.enabled, fallback.enabled),
    productId: normalizeText(plan?.productId) || undefined,
    productExternalId: normalizeText(plan?.productExternalId) || fallback.productExternalId,
  }
}

function normalizePlanCatalog(value: unknown, legacyAbacate: unknown, legacyStripe: unknown): Record<TenantPlanCode, PlanCatalogEntry> {
  const input = value as Record<string, unknown> | null
  const oldAbacate = (legacyAbacate as { plans?: Record<string, unknown> } | null)?.plans ?? {}
  const oldStripe = (legacyStripe as { plans?: Record<string, unknown> } | null)?.plans ?? {}
  const codes = new Set<string>([...builtInPlanCodes, ...Object.keys(oldAbacate), ...Object.keys(oldStripe), ...Object.keys(input ?? {})])
  const result: Record<string, PlanCatalogEntry> = {}

  for (const rawCode of codes) {
    const planCode = normalizePlanCode(rawCode)
    const fallback = defaultPlanCatalog[planCode as BuiltInTenantPlanCode] ?? {
      planCode,
      enabled: false,
      productName: planCode,
      description: "",
      priceCents: 0,
      tokensIncluded: 0,
      cycle: "MONTHLY" as const,
    }
    const central = (input?.[rawCode] ?? input?.[planCode]) as Partial<PlanCatalogEntry> | undefined
    const stripe = oldStripe[rawCode] as (Partial<PlanCatalogEntry> & { interval?: unknown }) | undefined
    const abacate = oldAbacate[rawCode] as (Partial<PlanCatalogEntry> & { cycle?: unknown }) | undefined
    const source = central ?? (stripe?.enabled ? stripe : abacate?.enabled ? abacate : stripe ?? abacate)
    const oldStripeCycle = stripe?.interval === "week" ? "WEEKLY" : stripe?.interval === "year" ? "ANNUALLY" : "MONTHLY"
    result[planCode] = {
      planCode,
      enabled: normalizeBoolean(central?.enabled, Boolean(stripe?.enabled || abacate?.enabled || fallback.enabled)),
      productName: normalizeText(source?.productName) || fallback.productName,
      description: normalizeText(source?.description) || fallback.description,
      priceCents: Math.max(0, Math.round(normalizeNumber(source?.priceCents, fallback.priceCents))),
      tokensIncluded: Math.max(0, Math.round(normalizeNumber(source?.tokensIncluded, fallback.tokensIncluded))),
      cycle: normalizeCycle(source?.cycle ?? abacate?.cycle ?? oldStripeCycle, fallback.cycle),
    }
  }

  return result
}

function normalizeSettings(value: unknown): AbacatePaySettings {
  const defaults = buildDefaultSettings()
  const settings = value as (Partial<AbacatePaySettings> & { plans?: Record<string, unknown> }) | null
  const baseUrl = normalizeText(settings?.baseUrl)
  const plans = settings?.plans as Partial<Record<TenantPlanCode, unknown>> | undefined

  return {
    enabled: normalizeBoolean(settings?.enabled, defaults.enabled),
    apiKey: normalizeText(settings?.apiKey) || process.env.ABACATEPAY_API_KEY?.trim() || undefined,
    baseUrl: baseUrl || defaults.baseUrl,
    webhookSecret: normalizeText(settings?.webhookSecret) || defaults.webhookSecret,
    webhookPublicKey: normalizeText(settings?.webhookPublicKey) || undefined,
    devMode: normalizeBoolean(settings?.devMode, defaults.devMode),
    returnUrl: normalizeText(settings?.returnUrl) || undefined,
    completionUrl: normalizeText(settings?.completionUrl) || undefined,
    plans: Object.fromEntries([...builtInPlanCodes, ...Object.keys(plans ?? {})].map((code) => {
      const planCode = normalizePlanCode(code)
      const fallback = defaultAbacatePayPlans[planCode as BuiltInTenantPlanCode] ?? { planCode, enabled: false, productExternalId: `comofica-${planCode}` }
      return [planCode, normalizeAbacatePayPlanLink(plans?.[code], fallback)]
    })),
    createdAt: normalizeText(settings?.createdAt) || defaults.createdAt,
    updatedAt: normalizeText(settings?.updatedAt) || defaults.updatedAt,
  }
}

function normalizeStripePlanLink(value: unknown, fallback: StripePlanConfig): StripePlanConfig {
  const plan = value as Partial<StripePlanConfig> | null
  return {
    planCode: fallback.planCode,
    enabled: normalizeBoolean(plan?.enabled, fallback.enabled),
    productId: normalizeText(plan?.productId) || undefined,
    priceId: normalizeText(plan?.priceId) || undefined,
  }
}

function normalizeStripeSettings(value: unknown): StripeSettings {
  const defaults = buildDefaultStripeSettings()
  const settings = value as (Partial<StripeSettings> & { plans?: Record<string, unknown> }) | null
  const plans = settings?.plans as Partial<Record<TenantPlanCode, unknown>> | undefined
  const currency = normalizeText(settings?.currency || defaults.currency).toLowerCase()

  return {
    enabled: normalizeBoolean(settings?.enabled, defaults.enabled),
    secretKey: normalizeText(settings?.secretKey) || process.env.STRIPE_SECRET_KEY?.trim() || undefined,
    webhookSecret: normalizeText(settings?.webhookSecret) || process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
    successUrl: normalizeText(settings?.successUrl) || undefined,
    cancelUrl: normalizeText(settings?.cancelUrl) || undefined,
    apiVersion: normalizeText(settings?.apiVersion) || defaults.apiVersion,
    currency: currency || defaults.currency,
    plans: Object.fromEntries([...builtInPlanCodes, ...Object.keys(plans ?? {})].map((code) => {
      const planCode = normalizePlanCode(code)
      const fallback = defaultStripePlans[planCode as BuiltInTenantPlanCode] ?? { planCode, enabled: false }
      return [planCode, normalizeStripePlanLink(plans?.[code], fallback)]
    })),
    createdAt: normalizeText(settings?.createdAt) || defaults.createdAt,
    updatedAt: normalizeText(settings?.updatedAt) || defaults.updatedAt,
  }
}

function normalizeSubscription(value: unknown): TenantBillingSubscription | null {
  const item = value as Partial<TenantBillingSubscription> | null
  const tenantId = normalizeText(item?.tenantId)
  const tenantSlug = normalizeText(item?.tenantSlug)

  if (!tenantId || !tenantSlug) {
    return null
  }

  return {
    tenantId,
    tenantSlug,
    planCode: normalizePlanCode(item?.planCode),
    status: statuses.has(item?.status as TenantBillingStatus) ? item!.status as TenantBillingStatus : "none",
    provider: item?.provider === "stripe" ? "stripe" : "abacatepay",
    customerId: normalizeText(item?.customerId) || undefined,
    customerEmail: normalizeText(item?.customerEmail).toLowerCase() || undefined,
    customerName: normalizeText(item?.customerName) || undefined,
    checkoutId: normalizeText(item?.checkoutId) || undefined,
    checkoutUrl: normalizeText(item?.checkoutUrl) || undefined,
    subscriptionId: normalizeText(item?.subscriptionId) || undefined,
    externalId: normalizeText(item?.externalId) || undefined,
    tokensIncluded: item?.tokensIncluded == null ? undefined : Math.max(0, Math.round(normalizeNumber(item.tokensIncluded))),
    productId: normalizeText(item?.productId) || undefined,
    priceId: normalizeText(item?.priceId) || undefined,
    amountCents: item?.amountCents == null ? undefined : Math.max(0, Math.round(normalizeNumber(item.amountCents))),
    paidAmountCents: item?.paidAmountCents == null ? undefined : Math.max(0, Math.round(normalizeNumber(item.paidAmountCents))),
    currency: normalizeText(item?.currency) || "BRL",
    receiptUrl: normalizeText(item?.receiptUrl) || undefined,
    lastWebhookEvent: normalizeText(item?.lastWebhookEvent) || undefined,
    lastWebhookId: normalizeText(item?.lastWebhookId) || undefined,
    lastWebhookAt: normalizeText(item?.lastWebhookAt) || undefined,
    activatedAt: normalizeText(item?.activatedAt) || undefined,
    cancelledAt: normalizeText(item?.cancelledAt) || undefined,
    createdAt: normalizeText(item?.createdAt) || now(),
    updatedAt: normalizeText(item?.updatedAt) || now(),
  }
}

function normalizeWebhookEvent(value: unknown): AbacatePayWebhookEventRecord | null {
  const item = value as Partial<AbacatePayWebhookEventRecord> | null
  const id = normalizeText(item?.id)
  const event = normalizeText(item?.event)

  if (!id || !event) {
    return null
  }

  return {
    id,
    event,
    provider: item?.provider === "stripe" ? "stripe" : "abacatepay",
    externalId: normalizeText(item?.externalId) || undefined,
    checkoutId: normalizeText(item?.checkoutId) || undefined,
    subscriptionId: normalizeText(item?.subscriptionId) || undefined,
    processed: normalizeBoolean(item?.processed, false),
    receivedAt: normalizeText(item?.receivedAt) || now(),
  }
}

function normalizeBillingData(value: unknown): BillingData {
  const source = value as (Partial<BillingData> & { planCatalog?: unknown }) | null
  return {
    planCatalog: normalizePlanCatalog(source?.planCatalog, source?.abacatePay, source?.stripe),
    abacatePay: normalizeSettings(source?.abacatePay),
    stripe: normalizeStripeSettings(source?.stripe),
    subscriptions: Array.isArray(source?.subscriptions)
      ? source.subscriptions.flatMap((item) => {
        const normalized = normalizeSubscription(item)
        return normalized ? [normalized] : []
      })
      : [],
    webhookEvents: Array.isArray(source?.webhookEvents)
      ? source.webhookEvents.flatMap((item) => {
        const normalized = normalizeWebhookEvent(item)
        return normalized ? [normalized] : []
      })
      : [],
  }
}

async function readBillingData() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: normalizeBillingData({}),
    normalize: normalizeBillingData,
  })
}

async function writeBillingData(data: BillingData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: normalizeBillingData({}) }, data)
}

async function withBillingMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)
  return run
}

export function toPublicAbacatePaySettings(settings: AbacatePaySettings, origin?: string): PublicAbacatePaySettings {
  const apiKey = settings.apiKey?.trim()
  const { apiKey: _apiKey, ...safeSettings } = settings
  void _apiKey
  const webhookSecret = settings.webhookSecret?.trim()
  const webhookUrl = origin && webhookSecret
    ? new URL(`/api/webhooks/abacatepay?webhookSecret=${encodeURIComponent(webhookSecret)}`, origin).toString()
    : undefined

  return {
    ...safeSettings,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : undefined,
    webhookUrl,
  }
}

export async function getAbacatePaySettings() {
  const data = await readBillingData()
  return data.abacatePay
}

export async function getPlanCatalog() {
  return (await readBillingData()).planCatalog
}

export async function updatePlanCatalog(input: Partial<Record<TenantPlanCode, Partial<PlanCatalogEntry>>>) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    const next: Record<string, PlanCatalogEntry> = { ...data.planCatalog }
    for (const [rawCode, patch] of Object.entries(input)) {
      const planCode = normalizePlanCode(rawCode)
      const current = next[planCode]
      if (!current || !patch) continue
      next[planCode] = {
        ...current,
        ...patch,
        planCode,
        productName: normalizeText(patch.productName ?? current.productName) || current.productName,
        description: normalizeText(patch.description ?? current.description),
        priceCents: Math.max(0, Math.round(normalizeNumber(patch.priceCents, current.priceCents))),
        tokensIncluded: Math.max(0, Math.round(normalizeNumber(patch.tokensIncluded, current.tokensIncluded))),
        cycle: normalizeCycle(patch.cycle, current.cycle),
      }
    }
    await writeBillingData({ ...data, planCatalog: next })
    return next
  })
}

export async function createPlanCatalogEntry(input: { planCode: string; productName: string; description?: string }) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    const planCode = normalizePlanCode(input.planCode)
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(planCode)) throw new Error("Use um código de 2 a 40 caracteres, começando por letra e contendo apenas letras, números ou hífens.")
    if (data.planCatalog[planCode]) throw new Error("Já existe um plano com esse código.")
    const productName = normalizeText(input.productName)
    if (!productName) throw new Error("Informe o nome do plano.")
    const plan: PlanCatalogEntry = {
      planCode,
      enabled: false,
      productName,
      description: normalizeText(input.description),
      priceCents: 0,
      tokensIncluded: 0,
      cycle: "MONTHLY",
    }
    const planCatalog = { ...data.planCatalog, [planCode]: plan }
    const abacatePay = { ...data.abacatePay, plans: { ...data.abacatePay.plans, [planCode]: { planCode, enabled: false, productExternalId: `comofica-${planCode}` } } }
    const stripe = { ...data.stripe, plans: { ...data.stripe.plans, [planCode]: { planCode, enabled: false } } }
    await writeBillingData({ ...data, planCatalog, abacatePay, stripe })
    return plan
  })
}

export async function updateAbacatePaySettings(input: Partial<AbacatePaySettings> & { clearApiKey?: boolean }) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    const current = data.abacatePay
    const updated = normalizeSettings({
      ...current,
      ...input,
      apiKey: input.clearApiKey ? "" : normalizeText(input.apiKey) || current.apiKey,
      plans: {
        ...current.plans,
        ...(input.plans ?? {}),
      },
      updatedAt: now(),
    })

    await writeBillingData({ ...data, abacatePay: updated })
    return updated
  })
}

export function toPublicStripeSettings(settings: StripeSettings, origin?: string): PublicStripeSettings {
  const secretKey = settings.secretKey?.trim()
  const webhookSecret = settings.webhookSecret?.trim()
  const { secretKey: _secretKey, webhookSecret: _webhookSecret, ...safeSettings } = settings
  void _secretKey
  void _webhookSecret
  const webhookUrl = origin ? new URL("/api/webhooks/stripe", origin).toString() : undefined

  return {
    ...safeSettings,
    secretKeyConfigured: Boolean(secretKey),
    secretKeyPreview: secretKey ? `${secretKey.slice(0, 7)}...${secretKey.slice(-4)}` : undefined,
    webhookSecretConfigured: Boolean(webhookSecret),
    webhookSecretPreview: webhookSecret ? `${webhookSecret.slice(0, 7)}...${webhookSecret.slice(-4)}` : undefined,
    webhookUrl,
  }
}

export async function getStripeSettings() {
  const data = await readBillingData()
  return data.stripe
}

export async function updateStripeSettings(input: Partial<StripeSettings> & {
  clearSecretKey?: boolean
  clearWebhookSecret?: boolean
}) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    const current = data.stripe
    const updated = normalizeStripeSettings({
      ...current,
      ...input,
      secretKey: input.clearSecretKey ? "" : normalizeText(input.secretKey) || current.secretKey,
      webhookSecret: input.clearWebhookSecret ? "" : normalizeText(input.webhookSecret) || current.webhookSecret,
      plans: {
        ...current.plans,
        ...(input.plans ?? {}),
      },
      updatedAt: now(),
    })

    await writeBillingData({ ...data, stripe: updated })
    return updated
  })
}

export async function getTenantBillingSubscription(tenant: Tenant) {
  const data = await readBillingData()
  return data.subscriptions.find((item) => item.tenantId === tenant.id || item.tenantSlug === tenant.slug) ?? null
}

export async function upsertTenantBillingSubscription(input: TenantBillingSubscription) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    const timestamp = now()
    const existing = data.subscriptions.find((item) =>
      item.tenantId === input.tenantId ||
      (input.externalId && item.externalId === input.externalId) ||
      (input.checkoutId && item.checkoutId === input.checkoutId) ||
      (input.subscriptionId && item.subscriptionId === input.subscriptionId)
    )
    const next: TenantBillingSubscription = normalizeSubscription({
      ...existing,
      ...input,
      createdAt: existing?.createdAt ?? input.createdAt ?? timestamp,
      updatedAt: timestamp,
    })!

    await writeBillingData({
      ...data,
      subscriptions: [
        next,
        ...data.subscriptions.filter((item) =>
          item !== existing && !(item.tenantId === input.tenantId && item.provider === input.provider)
        ),
      ],
    })

    return next
  })
}

export async function findBillingSubscriptionByAbacatePayReference(input: {
  externalId?: string
  checkoutId?: string
  subscriptionId?: string
}) {
  const data = await readBillingData()
  return data.subscriptions.find((item) =>
    (input.externalId && item.externalId === input.externalId) ||
    (input.checkoutId && item.checkoutId === input.checkoutId) ||
    (input.subscriptionId && item.subscriptionId === input.subscriptionId)
  ) ?? null
}

export async function findBillingSubscriptionByStripeReference(input: {
  checkoutId?: string
  subscriptionId?: string
  customerId?: string
}) {
  const data = await readBillingData()
  return data.subscriptions.find((item) =>
    item.provider === "stripe" &&
    (
      (input.checkoutId && item.checkoutId === input.checkoutId) ||
      (input.subscriptionId && item.subscriptionId === input.subscriptionId) ||
      (input.customerId && item.customerId === input.customerId)
    )
  ) ?? null
}

export async function recordAbacatePayWebhookEvent(input: Omit<AbacatePayWebhookEventRecord, "provider" | "receivedAt"> & {
  provider?: BillingProvider
}) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    const existing = data.webhookEvents.find((event) => event.id === input.id)

    if (existing) {
      return { event: existing, created: false }
    }

    const event: AbacatePayWebhookEventRecord = {
      ...input,
      provider: input.provider ?? "abacatepay",
      receivedAt: now(),
    }

    await writeBillingData({
      ...data,
      webhookEvents: [event, ...data.webhookEvents].slice(0, 250),
    })

    return { event, created: true }
  })
}

export async function markAbacatePayWebhookEventProcessed(id: string) {
  return withBillingMutation(async () => {
    const data = await readBillingData()
    await writeBillingData({
      ...data,
      webhookEvents: data.webhookEvents.map((event) =>
        event.id === id ? { ...event, processed: true } : event
      ),
    })
  })
}

export function getConfiguredPlan(settings: AbacatePaySettings, planCatalog: Record<TenantPlanCode, PlanCatalogEntry>, planCode: TenantPlanCode, tenant?: Tenant) {
  const configured = planCatalog[planCode]
  const plan = configured && tenant?.planCode === "custom" && planCode === "custom" && tenant.customPlan ? { ...configured, ...tenant.customPlan, cycle: "MONTHLY" as const } : configured
  const paymentLink = settings.plans[planCode]

  if (!plan) throw new Error(`O plano ${planCode} não existe.`)

  if (!settings.enabled) {
    throw new Error("AbacatePay ainda nao esta habilitado.")
  }

  if (!settings.apiKey) {
    throw new Error("Configure a API key da AbacatePay antes de gerar assinaturas.")
  }

  if (!plan.enabled || !paymentLink?.enabled) {
    throw new Error(`O plano ${planCode} nao esta habilitado para assinatura AbacatePay.`)
  }

  if (!paymentLink.productId && !(planCode === "custom" && tenant?.planCode === "custom" && tenant.customPlan)) {
    throw new Error(`Cadastre ou informe o productId da AbacatePay para o plano ${planCode}.`)
  }

  return { ...plan, ...paymentLink }
}

export function getConfiguredStripePlan(settings: StripeSettings, planCatalog: Record<TenantPlanCode, PlanCatalogEntry>, planCode: TenantPlanCode, tenant?: Tenant) {
  const configured = planCatalog[planCode]
  const plan = configured && tenant?.planCode === "custom" && planCode === "custom" && tenant.customPlan ? { ...configured, ...tenant.customPlan, cycle: "MONTHLY" as const } : configured
  const paymentLink = settings.plans[planCode]

  if (!plan) throw new Error(`O plano ${planCode} não existe.`)

  if (!settings.enabled) {
    throw new Error("Stripe esta configurado como fallback, mas ainda nao esta habilitado.")
  }

  if (!settings.secretKey) {
    throw new Error("Configure a secret key do Stripe antes de gerar checkouts.")
  }

  if (!plan.enabled || !paymentLink?.enabled) {
    throw new Error(`O plano ${planCode} nao esta habilitado para checkout Stripe.`)
  }

  if (!paymentLink.priceId && !(planCode === "custom" && tenant?.planCode === "custom" && tenant.customPlan)) {
    throw new Error(`Crie ou informe o priceId Stripe para o plano ${planCode}.`)
  }

  return { ...plan, ...paymentLink, interval: cycleToStripeInterval(plan.cycle) }
}

export function cycleToStripeInterval(cycle: AbacatePayCycle): StripeInterval {
  if (cycle === "WEEKLY") return "week"
  if (cycle === "ANNUALLY") return "year"
  return "month"
}

export function getPlanCodes(planCatalog: Record<TenantPlanCode, PlanCatalogEntry>) {
  return Object.keys(planCatalog)
}
