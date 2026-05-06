import type {
  CreditCoupon,
  CreditCouponRedemption,
  ReferralProgramSettings,
  TenantReferral,
  TenantReferralProgram,
} from "@/lib/commercial-benefits-types"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"
import { findTenant } from "@/lib/server/tenants-store"
import { grantTenantManualTokens } from "@/lib/server/token-ledger-store"

type CommercialBenefitsData = {
  coupons: CreditCoupon[]
  redemptions: CreditCouponRedemption[]
  referralSettings: ReferralProgramSettings
  referrals: TenantReferral[]
}

const dataFile = getRuntimeDataFile("commercial-benefits.json")
const storeKey = "commercial-benefits"
let mutationQueue = Promise.resolve()

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function buildReferralCode(tenantSlug: string) {
  return normalizeCode(`CF-${tenantSlug}`).slice(0, 40)
}

function normalizeSettings(value: unknown): ReferralProgramSettings {
  const item = value as Partial<ReferralProgramSettings> | null
  const now = new Date().toISOString()

  return {
    enabled: normalizeBoolean(item?.enabled, true),
    defaultCreditAmount: Math.max(1, Math.round(normalizeNumber(item?.defaultCreditAmount, 25))),
    createdAt: normalizeText(item?.createdAt) || now,
    updatedAt: normalizeText(item?.updatedAt) || now,
  }
}

function normalizeCoupon(value: unknown): CreditCoupon | null {
  const item = value as Partial<CreditCoupon> | null
  const id = normalizeText(item?.id)
  const code = normalizeCode(normalizeText(item?.code))

  if (!id || !code) {
    return null
  }

  return {
    id,
    code,
    creditAmount: Math.max(1, Math.round(normalizeNumber(item?.creditAmount))),
    status: item?.status === "inactive" ? "inactive" : "active",
    expiresAt: normalizeText(item?.expiresAt) || undefined,
    maxRedemptions: Math.max(0, Math.round(normalizeNumber(item?.maxRedemptions))) || undefined,
    maxRedemptionsPerTenant: Math.max(1, Math.round(normalizeNumber(item?.maxRedemptionsPerTenant, 1))),
    notes: normalizeText(item?.notes) || undefined,
    createdAt: normalizeText(item?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(item?.updatedAt) || new Date().toISOString(),
  }
}

function normalizeRedemption(value: unknown): CreditCouponRedemption | null {
  const item = value as Partial<CreditCouponRedemption> | null
  const id = normalizeText(item?.id)
  const couponId = normalizeText(item?.couponId)
  const code = normalizeCode(normalizeText(item?.code))
  const tenantSlug = normalizeText(item?.tenantSlug)

  if (!id || !couponId || !code || !tenantSlug) {
    return null
  }

  return {
    id,
    couponId,
    code,
    tenantSlug,
    creditsGranted: Math.max(0, Math.round(normalizeNumber(item?.creditsGranted))),
    ledgerEntryId: normalizeText(item?.ledgerEntryId) || undefined,
    redeemedAt: normalizeText(item?.redeemedAt) || new Date().toISOString(),
  }
}

function normalizeReferral(value: unknown): TenantReferral | null {
  const item = value as Partial<TenantReferral> | null
  const id = normalizeText(item?.id)
  const code = normalizeCode(normalizeText(item?.code))
  const referrerTenantSlug = normalizeText(item?.referrerTenantSlug)

  if (!id || !code || !referrerTenantSlug) {
    return null
  }

  return {
    id,
    code,
    referrerTenantSlug,
    referredTenantSlug: normalizeText(item?.referredTenantSlug) || undefined,
    referredTenantId: normalizeText(item?.referredTenantId) || undefined,
    status: item?.status === "converted" || item?.status === "cancelled" ? item.status : "pending",
    creditsGranted: Math.max(0, Math.round(normalizeNumber(item?.creditsGranted))),
    subscriptionReferenceId: normalizeText(item?.subscriptionReferenceId) || undefined,
    ledgerEntryId: normalizeText(item?.ledgerEntryId) || undefined,
    createdAt: normalizeText(item?.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(item?.updatedAt) || new Date().toISOString(),
    convertedAt: normalizeText(item?.convertedAt) || undefined,
    cancelledAt: normalizeText(item?.cancelledAt) || undefined,
  }
}

function normalizeData(value: unknown): CommercialBenefitsData {
  const source = value as Partial<CommercialBenefitsData> | null

  return {
    coupons: Array.isArray(source?.coupons) ? source.coupons.flatMap((item) => {
      const coupon = normalizeCoupon(item)
      return coupon ? [coupon] : []
    }) : [],
    redemptions: Array.isArray(source?.redemptions) ? source.redemptions.flatMap((item) => {
      const redemption = normalizeRedemption(item)
      return redemption ? [redemption] : []
    }) : [],
    referralSettings: normalizeSettings(source?.referralSettings),
    referrals: Array.isArray(source?.referrals) ? source.referrals.flatMap((item) => {
      const referral = normalizeReferral(item)
      return referral ? [referral] : []
    }) : [],
  }
}

async function readData() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: normalizeData({}),
    normalize: normalizeData,
  })
}

async function writeData(data: CommercialBenefitsData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: normalizeData({}) }, data)
}

async function withMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)
  return run
}

function sortCoupons(coupons: CreditCoupon[]) {
  return [...coupons].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function sortReferrals(referrals: TenantReferral[]) {
  return [...referrals].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function listCreditCoupons() {
  const data = await readData()
  return {
    coupons: sortCoupons(data.coupons),
    redemptions: [...data.redemptions].sort((left, right) => new Date(right.redeemedAt).getTime() - new Date(left.redeemedAt).getTime()),
  }
}

export async function createCreditCoupon(input: {
  code: string
  creditAmount: number
  status?: "active" | "inactive"
  expiresAt?: string
  maxRedemptions?: number
  maxRedemptionsPerTenant?: number
  notes?: string
}) {
  return withMutation(async () => {
    const data = await readData()
    const code = normalizeCode(input.code)
    const now = new Date().toISOString()

    if (!code) {
      throw new Error("Informe um código de cupom válido.")
    }

    if (data.coupons.some((coupon) => coupon.code === code)) {
      throw new Error("Este código de cupom já existe.")
    }

    const coupon: CreditCoupon = {
      id: crypto.randomUUID(),
      code,
      creditAmount: Math.max(1, Math.round(input.creditAmount)),
      status: input.status === "inactive" ? "inactive" : "active",
      expiresAt: normalizeText(input.expiresAt) || undefined,
      maxRedemptions: Math.max(0, Math.round(normalizeNumber(input.maxRedemptions))) || undefined,
      maxRedemptionsPerTenant: Math.max(1, Math.round(normalizeNumber(input.maxRedemptionsPerTenant, 1))),
      notes: normalizeText(input.notes) || undefined,
      createdAt: now,
      updatedAt: now,
    }

    await writeData({ ...data, coupons: [coupon, ...data.coupons] })
    return coupon
  })
}

export async function updateCreditCoupon(id: string, input: Partial<CreditCoupon>) {
  return withMutation(async () => {
    const data = await readData()
    const existing = data.coupons.find((coupon) => coupon.id === id)

    if (!existing) {
      return null
    }

    const nextCode = input.code ? normalizeCode(input.code) : existing.code

    if (!nextCode) {
      throw new Error("Informe um código de cupom válido.")
    }

    if (data.coupons.some((coupon) => coupon.id !== id && coupon.code === nextCode)) {
      throw new Error("Este código de cupom já existe.")
    }

    const updated: CreditCoupon = {
      ...existing,
      code: nextCode,
      creditAmount: input.creditAmount === undefined ? existing.creditAmount : Math.max(1, Math.round(input.creditAmount)),
      status: input.status === undefined ? existing.status : input.status === "inactive" ? "inactive" : "active",
      expiresAt: input.expiresAt === undefined ? existing.expiresAt : normalizeText(input.expiresAt) || undefined,
      maxRedemptions: input.maxRedemptions === undefined
        ? existing.maxRedemptions
        : Math.max(0, Math.round(normalizeNumber(input.maxRedemptions))) || undefined,
      maxRedemptionsPerTenant: Math.max(1, Math.round(normalizeNumber(input.maxRedemptionsPerTenant, existing.maxRedemptionsPerTenant))),
      notes: input.notes === undefined ? existing.notes : normalizeText(input.notes) || undefined,
      updatedAt: new Date().toISOString(),
    }

    await writeData({
      ...data,
      coupons: data.coupons.map((coupon) => coupon.id === id ? updated : coupon),
    })

    return updated
  })
}

export async function redeemCreditCoupon(tenantSlug: string, codeInput: string) {
  return withMutation(async () => {
    const data = await readData()
    const code = normalizeCode(codeInput)
    const coupon = data.coupons.find((item) => item.code === code)

    if (!coupon) {
      throw new Error("Cupom não encontrado.")
    }

    if (coupon.status !== "active") {
      throw new Error("Este cupom não está ativo.")
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      throw new Error("Este cupom expirou.")
    }

    const totalRedemptions = data.redemptions.filter((item) => item.couponId === coupon.id).length
    if (coupon.maxRedemptions && totalRedemptions >= coupon.maxRedemptions) {
      throw new Error("Este cupom atingiu o limite de usos.")
    }

    const tenantRedemptions = data.redemptions.filter((item) => item.couponId === coupon.id && item.tenantSlug === tenantSlug).length
    if (tenantRedemptions >= coupon.maxRedemptionsPerTenant) {
      throw new Error("Este cupom já foi usado por este tenant.")
    }

    const ledger = await grantTenantManualTokens({
      tenantSlug,
      amount: coupon.creditAmount,
      description: `Cupom aplicado: ${coupon.code}.`,
      createdBy: "coupon",
      referenceType: "coupon",
      referenceId: coupon.id,
    })
    const redemption: CreditCouponRedemption = {
      id: crypto.randomUUID(),
      couponId: coupon.id,
      code: coupon.code,
      tenantSlug,
      creditsGranted: coupon.creditAmount,
      ledgerEntryId: ledger.entry.id,
      redeemedAt: new Date().toISOString(),
    }

    const nextData = await readData()
    await writeData({
      ...nextData,
      redemptions: [redemption, ...nextData.redemptions],
    })

    return { coupon, redemption, tokenSnapshot: ledger.account }
  })
}

export async function getReferralSettings() {
  const data = await readData()
  return data.referralSettings
}

export async function updateReferralSettings(input: Partial<ReferralProgramSettings>) {
  return withMutation(async () => {
    const data = await readData()
    const updated: ReferralProgramSettings = {
      ...data.referralSettings,
      enabled: input.enabled ?? data.referralSettings.enabled,
      defaultCreditAmount: Math.max(1, Math.round(normalizeNumber(input.defaultCreditAmount, data.referralSettings.defaultCreditAmount))),
      updatedAt: new Date().toISOString(),
    }

    await writeData({ ...data, referralSettings: updated })
    return updated
  })
}

export async function listTenantReferrals(tenantSlug?: string) {
  const data = await readData()
  const referrals = tenantSlug
    ? data.referrals.filter((referral) => referral.referrerTenantSlug === tenantSlug || referral.referredTenantSlug === tenantSlug)
    : data.referrals

  return {
    settings: data.referralSettings,
    referrals: sortReferrals(referrals),
  }
}

export async function ensureTenantReferralCode(tenantSlug: string) {
  return withMutation(async () => {
    const data = await readData()
    const existing = data.referrals.find((referral) =>
      referral.referrerTenantSlug === tenantSlug &&
      !referral.referredTenantSlug &&
      referral.status === "pending"
    )

    if (existing) {
      return existing.code
    }

    const now = new Date().toISOString()
    const code = buildReferralCode(tenantSlug)
    const referral: TenantReferral = {
      id: crypto.randomUUID(),
      code,
      referrerTenantSlug: tenantSlug,
      status: "pending",
      creditsGranted: 0,
      createdAt: now,
      updatedAt: now,
    }

    await writeData({ ...data, referrals: [referral, ...data.referrals] })
    return code
  })
}

export async function getTenantReferralProgram(tenantSlug: string): Promise<TenantReferralProgram> {
  const [data, code] = await Promise.all([readData(), ensureTenantReferralCode(tenantSlug)])

  return {
    settings: data.referralSettings,
    code,
    referralUrl: `${getPublicAppBaseUrl()}/?ref=${encodeURIComponent(code)}`,
    referrals: sortReferrals(data.referrals.filter((referral) => referral.referrerTenantSlug === tenantSlug)),
  }
}

export async function attachReferralToTenant(input: {
  referralCode: string
  referredTenantId: string
  referredTenantSlug: string
}) {
  const code = normalizeCode(input.referralCode)
  if (!code) return null

  return withMutation(async () => {
    const data = await readData()
    const referrer = data.referrals.find((referral) =>
      referral.code === code &&
      !referral.referredTenantSlug &&
      referral.status === "pending"
    )

    if (!referrer || referrer.referrerTenantSlug === input.referredTenantSlug) {
      return null
    }

    const existing = data.referrals.find((referral) =>
      referral.referredTenantSlug === input.referredTenantSlug &&
      referral.status !== "cancelled"
    )

    if (existing) {
      return existing
    }

    const now = new Date().toISOString()
    const referral: TenantReferral = {
      id: crypto.randomUUID(),
      code,
      referrerTenantSlug: referrer.referrerTenantSlug,
      referredTenantSlug: input.referredTenantSlug,
      referredTenantId: input.referredTenantId,
      status: "pending",
      creditsGranted: 0,
      createdAt: now,
      updatedAt: now,
    }

    await writeData({ ...data, referrals: [referral, ...data.referrals] })
    return referral
  })
}

export async function grantReferralConversionCredits(input: {
  referredTenantSlug: string
  subscriptionReferenceId: string
}) {
  return withMutation(async () => {
    const data = await readData()

    if (!data.referralSettings.enabled) {
      return { granted: false as const, reason: "referral_disabled" }
    }

    const referral = data.referrals.find((item) =>
      item.referredTenantSlug === input.referredTenantSlug &&
      item.status === "pending"
    )

    if (!referral) {
      return { granted: false as const, reason: "referral_not_found" }
    }

    const referrerTenant = await findTenant(referral.referrerTenantSlug)
    if (!referrerTenant) {
      return { granted: false as const, reason: "referrer_not_found" }
    }

    const amount = data.referralSettings.defaultCreditAmount
    const ledger = await grantTenantManualTokens({
      tenantSlug: referrerTenant.slug,
      amount,
      description: `Créditos por indicação convertida: ${input.referredTenantSlug}.`,
      createdBy: "referral",
      referenceType: "referral",
      referenceId: referral.id,
    })
    const converted: TenantReferral = {
      ...referral,
      status: "converted",
      creditsGranted: amount,
      subscriptionReferenceId: input.subscriptionReferenceId,
      ledgerEntryId: ledger.entry.id,
      convertedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const nextData = await readData()

    await writeData({
      ...nextData,
      referrals: nextData.referrals.map((item) => item.id === referral.id ? converted : item),
    })

    return { granted: true as const, referral: converted }
  })
}
