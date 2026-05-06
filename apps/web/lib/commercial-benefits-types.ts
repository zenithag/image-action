export type CouponStatus = "active" | "inactive"

export type CreditCoupon = {
  id: string
  code: string
  creditAmount: number
  status: CouponStatus
  expiresAt?: string
  maxRedemptions?: number
  maxRedemptionsPerTenant: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type CreditCouponRedemption = {
  id: string
  couponId: string
  code: string
  tenantSlug: string
  creditsGranted: number
  ledgerEntryId?: string
  redeemedAt: string
}

export type ReferralStatus = "pending" | "converted" | "cancelled"

export type ReferralProgramSettings = {
  enabled: boolean
  defaultCreditAmount: number
  createdAt: string
  updatedAt: string
}

export type TenantReferral = {
  id: string
  code: string
  referrerTenantSlug: string
  referredTenantSlug?: string
  referredTenantId?: string
  status: ReferralStatus
  creditsGranted: number
  subscriptionReferenceId?: string
  ledgerEntryId?: string
  createdAt: string
  updatedAt: string
  convertedAt?: string
  cancelledAt?: string
}

export type TenantReferralProgram = {
  settings: ReferralProgramSettings
  code: string
  referralUrl: string
  referrals: TenantReferral[]
}
