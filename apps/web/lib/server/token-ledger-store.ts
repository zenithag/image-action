import type {
  TenantTokenAccount,
  TenantTokenLedgerEntry,
  TenantTokenSnapshot,
  TokenLedgerEntryType,
  TokenLedgerReferenceType,
} from "@/lib/token-ledger-types"
import type { TenantPlanCode } from "@/lib/tenant-types"
import { findTenant } from "@/lib/server/tenants-store"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type TokenLedgerData = {
  accounts: TenantTokenAccount[]
  entries: TenantTokenLedgerEntry[]
}

const dataFile = getRuntimeDataFile("tenant-token-ledger.json")
const storeKey = "tenant-token-ledger"
let mutationQueue = Promise.resolve()

const PLAN_TOKEN_CREDITS: Record<TenantPlanCode, number> = {
  starter: 100,
  pro: 500,
  enterprise: 2000,
  custom: 0,
}

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

function normalizePlanCode(value: unknown): TenantPlanCode {
  return value === "pro" || value === "enterprise" || value === "custom" ? value : "starter"
}

function normalizeAccount(value: unknown): TenantTokenAccount | null {
  const item = value as Partial<TenantTokenAccount>
  const tenantSlug = normalizeText(item.tenantSlug)

  if (!tenantSlug) {
    return null
  }

  return {
    tenantSlug,
    planCode: normalizePlanCode(item.planCode),
    includedTokens: Math.max(0, normalizeNumber(item.includedTokens)),
    bonusTokens: Math.max(0, normalizeNumber(item.bonusTokens)),
    consumedTokens: Math.max(0, normalizeNumber(item.consumedTokens)),
    overageTokens: Math.max(0, normalizeNumber(item.overageTokens)),
    balance: normalizeNumber(item.balance),
    lowBalanceThreshold: Math.max(0, normalizeNumber(item.lowBalanceThreshold, 10)),
    allowOverage: normalizeBoolean(item.allowOverage, false),
    createdAt: normalizeText(item.createdAt) || new Date().toISOString(),
    updatedAt: normalizeText(item.updatedAt) || new Date().toISOString(),
    lastEntryAt: normalizeText(item.lastEntryAt) || undefined,
  }
}

function normalizeEntry(value: unknown): TenantTokenLedgerEntry | null {
  const item = value as Partial<TenantTokenLedgerEntry>
  const id = normalizeText(item.id)
  const tenantSlug = normalizeText(item.tenantSlug)

  if (!id || !tenantSlug) {
    return null
  }

  return {
    id,
    tenantSlug,
    type: (
      item.type === "manual_credit" ||
      item.type === "composition_debit" ||
      item.type === "refund" ||
      item.type === "admin_adjustment"
    ) ? item.type : "plan_credit",
    amount: normalizeNumber(item.amount),
    balanceAfter: normalizeNumber(item.balanceAfter),
    description: normalizeText(item.description),
    referenceType: (
      item.referenceType === "composition_job" ||
      item.referenceType === "admin_adjustment" ||
      item.referenceType === "coupon" ||
      item.referenceType === "referral"
    ) ? item.referenceType : item.referenceType === "plan" ? "plan" : undefined,
    referenceId: normalizeText(item.referenceId) || undefined,
    createdBy: normalizeText(item.createdBy) || undefined,
    createdAt: normalizeText(item.createdAt) || new Date().toISOString(),
  }
}

async function withTokenLedgerMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)
  return run
}

async function readTokenLedgerData(): Promise<TokenLedgerData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { accounts: [], entries: [] },
    normalize: (parsed) => {
      const source = parsed as Partial<TokenLedgerData> | null
      const accounts = Array.isArray(source?.accounts) ? source.accounts : []
      const entries = Array.isArray(source?.entries) ? source.entries : []

      return {
        accounts: accounts.flatMap((account) => {
          const normalized = normalizeAccount(account)
          return normalized ? [normalized] : []
        }),
        entries: entries.flatMap((entry) => {
          const normalized = normalizeEntry(entry)
          return normalized ? [normalized] : []
        }),
      }
    },
  })
}

async function writeTokenLedgerData(data: TokenLedgerData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { accounts: [], entries: [] } }, data)
}

function sortEntries(entries: TenantTokenLedgerEntry[]) {
  return [...entries].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function buildDefaultAccount(tenantSlug: string, planCode: TenantPlanCode): TenantTokenAccount {
  const now = new Date().toISOString()
  const includedTokens = PLAN_TOKEN_CREDITS[planCode]

  return {
    tenantSlug,
    planCode,
    includedTokens,
    bonusTokens: 0,
    consumedTokens: 0,
    overageTokens: 0,
    balance: includedTokens,
    lowBalanceThreshold: Math.min(10, includedTokens),
    allowOverage: false,
    createdAt: now,
    updatedAt: now,
    lastEntryAt: now,
  }
}

async function buildInitialAccountForTenant(tenantSlug: string) {
  const tenant = await findTenant(tenantSlug)
  const planCode = tenant?.planCode ?? "starter"
  const account = buildDefaultAccount(tenantSlug, planCode)
  const initialEntry = buildLedgerEntry({
    tenantSlug,
    type: "plan_credit",
    amount: account.includedTokens,
    balanceAfter: account.balance,
    description: `Crédito inicial do plano ${planCode}.`,
    referenceType: "plan",
    referenceId: planCode,
    createdBy: "system",
  })

  return { account, initialEntry }
}

function buildLedgerEntry(input: {
  tenantSlug: string
  type: TokenLedgerEntryType
  amount: number
  balanceAfter: number
  description: string
  referenceType?: TokenLedgerReferenceType
  referenceId?: string
  createdBy?: string
}): TenantTokenLedgerEntry {
  return {
    id: crypto.randomUUID(),
    tenantSlug: input.tenantSlug,
    type: input.type,
    amount: input.amount,
    balanceAfter: input.balanceAfter,
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  }
}

function applyEntryToAccount(account: TenantTokenAccount, entry: TenantTokenLedgerEntry): TenantTokenAccount {
  const nextConsumed = entry.amount < 0 ? account.consumedTokens + Math.abs(entry.amount) : account.consumedTokens
  const nextBonus = entry.type === "manual_credit" || entry.type === "admin_adjustment" || entry.type === "refund"
    ? account.bonusTokens + Math.max(0, entry.amount)
    : account.bonusTokens
  const nextOverage = entry.balanceAfter < 0 ? Math.abs(entry.balanceAfter) : 0

  return {
    ...account,
    balance: entry.balanceAfter,
    consumedTokens: nextConsumed,
    bonusTokens: nextBonus,
    overageTokens: nextOverage,
    updatedAt: entry.createdAt,
    lastEntryAt: entry.createdAt,
  }
}

function getTokenAccountFlags(account: TenantTokenAccount) {
  return {
    isLowBalance: account.balance <= account.lowBalanceThreshold,
    isExhausted: account.balance <= 0,
  }
}

export async function ensureTenantTokenAccount(tenantSlug: string): Promise<TenantTokenAccount> {
  return withTokenLedgerMutation(async () => {
    const data = await readTokenLedgerData()
    const existing = data.accounts.find((account) => account.tenantSlug === tenantSlug)

    if (existing) {
      return existing
    }

    const { account, initialEntry } = await buildInitialAccountForTenant(tenantSlug)

    await writeTokenLedgerData({
      accounts: [account, ...data.accounts],
      entries: [initialEntry, ...data.entries],
    })

    return account
  })
}

export async function listTenantTokenEntries(tenantSlug: string, limit = 20) {
  const data = await readTokenLedgerData()
  const tenantEntries = data.entries.filter((entry) => entry.tenantSlug === tenantSlug)
  return sortEntries(tenantEntries).slice(0, Math.max(1, limit))
}

export async function getTenantTokenSnapshot(tenantSlug: string, limit = 20): Promise<TenantTokenSnapshot> {
  const account = await ensureTenantTokenAccount(tenantSlug)
  const entries = await listTenantTokenEntries(tenantSlug, limit)
  return {
    account,
    entries,
    ...getTokenAccountFlags(account),
  }
}

export async function canTenantCreateComposition(tenantSlug: string) {
  const snapshot = await getTenantTokenSnapshot(tenantSlug, 5)

  if (snapshot.account.allowOverage) {
    return { allowed: true, snapshot }
  }

  return {
    allowed: !snapshot.isExhausted,
    snapshot,
  }
}

export async function grantTenantManualTokens(input: {
  tenantSlug: string
  amount: number
  description?: string
  createdBy?: string
  referenceType?: TokenLedgerReferenceType
  referenceId?: string
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Informe uma quantidade positiva de tokens.")
  }

  return withTokenLedgerMutation(async () => {
    const data = await readTokenLedgerData()
    const existing = data.accounts.find((account) => account.tenantSlug === input.tenantSlug)
    const initial = existing ? null : await buildInitialAccountForTenant(input.tenantSlug)
    const account = existing ?? initial!.account
    const nextBalance = account.balance + Math.round(input.amount)
    const entry = buildLedgerEntry({
      tenantSlug: input.tenantSlug,
      type: "manual_credit",
      amount: Math.round(input.amount),
      balanceAfter: nextBalance,
      description: input.description?.trim() || "Crédito manual liberado pelo superadmin.",
      referenceType: input.referenceType ?? "admin_adjustment",
      referenceId: input.referenceId,
      createdBy: input.createdBy || "superadmin",
    })
    const nextAccount = applyEntryToAccount(account, entry)

    await writeTokenLedgerData({
      accounts: [
        nextAccount,
        ...data.accounts.filter((item) => item.tenantSlug !== input.tenantSlug),
      ],
      entries: [
        entry,
        ...(initial ? [initial.initialEntry] : []),
        ...data.entries,
      ],
    })

    return { account: nextAccount, entry }
  })
}

export async function recordCompositionTokenDebit(input: {
  tenantSlug: string
  jobId: string
  amount?: number
  description?: string
}) {
  const debitAmount = Math.max(1, Math.round(input.amount ?? 1))

  return withTokenLedgerMutation(async () => {
    const data = await readTokenLedgerData()
    const existingEntry = data.entries.find((entry) =>
      entry.tenantSlug === input.tenantSlug &&
      entry.type === "composition_debit" &&
      entry.referenceType === "composition_job" &&
      entry.referenceId === input.jobId
    )

    if (existingEntry) {
      const existingAccount = data.accounts.find((account) => account.tenantSlug === input.tenantSlug)

      if (existingAccount) {
        return { account: existingAccount, entry: existingEntry, created: false }
      }

      const initial = await buildInitialAccountForTenant(input.tenantSlug)
      await writeTokenLedgerData({
        accounts: [initial.account, ...data.accounts],
        entries: [initial.initialEntry, ...data.entries],
      })

      return { account: initial.account, entry: existingEntry, created: false }
    }

    const existingAccount = data.accounts.find((account) => account.tenantSlug === input.tenantSlug)
    const initial = existingAccount ? null : await buildInitialAccountForTenant(input.tenantSlug)
    const account = existingAccount ?? initial!.account
    const nextBalance = account.balance - debitAmount
    const entry = buildLedgerEntry({
      tenantSlug: input.tenantSlug,
      type: "composition_debit",
      amount: -debitAmount,
      balanceAfter: nextBalance,
      description: input.description?.trim() || `Débito pela composição ${input.jobId.slice(0, 8)}.`,
      referenceType: "composition_job",
      referenceId: input.jobId,
      createdBy: "system",
    })
    const nextAccount = applyEntryToAccount(account, entry)

    await writeTokenLedgerData({
      accounts: [
        nextAccount,
        ...data.accounts.filter((item) => item.tenantSlug !== input.tenantSlug),
      ],
      entries: [
        entry,
        ...(initial ? [initial.initialEntry] : []),
        ...data.entries,
      ],
    })

    return { account: nextAccount, entry, created: true }
  })
}
