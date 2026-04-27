import type { TenantPlanCode } from "@/lib/tenant-types"

export type TokenLedgerEntryType =
  | "plan_credit"
  | "manual_credit"
  | "composition_debit"
  | "refund"
  | "admin_adjustment"

export type TokenLedgerReferenceType = "plan" | "composition_job" | "admin_adjustment"

export type TenantTokenAccount = {
  tenantSlug: string
  planCode: TenantPlanCode
  includedTokens: number
  bonusTokens: number
  consumedTokens: number
  overageTokens: number
  balance: number
  lowBalanceThreshold: number
  allowOverage: boolean
  createdAt: string
  updatedAt: string
  lastEntryAt?: string
}

export type TenantTokenLedgerEntry = {
  id: string
  tenantSlug: string
  type: TokenLedgerEntryType
  amount: number
  balanceAfter: number
  description: string
  referenceType?: TokenLedgerReferenceType
  referenceId?: string
  createdBy?: string
  createdAt: string
}

export type TenantTokenSnapshot = {
  account: TenantTokenAccount
  entries: TenantTokenLedgerEntry[]
  isLowBalance: boolean
  isExhausted: boolean
}
