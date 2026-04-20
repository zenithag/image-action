export type TenantSettingsTeamMemberStatus = "active" | "invited" | "disabled"
export type TenantSettingsTeamMemberRole = "admin" | "operator" | "viewer"

export type TenantSettingsTeamMember = {
  id: string
  name: string
  email: string
  role: TenantSettingsTeamMemberRole
  status: TenantSettingsTeamMemberStatus
}

export type TenantSettings = {
  tenantSlug: string
  general: {
    companyName: string
    description: string
    timezone: string
    locale: string
  }
  branding: {
    primaryColor: string
    logoUrl: string
    brandVoice: string
  }
  channels: {
    whatsappEnabled: boolean
    instagramEnabled: boolean
    telegramEnabled: boolean
    handoffMode: "manual" | "auto"
  }
  assistant: {
    enabled: boolean
    modelProfileId: string
    systemPrompt: string
    humanHandoffKeywords: string[]
  }
  team: {
    members: TenantSettingsTeamMember[]
  }
  notifications: {
    emailNotifications: boolean
    whatsappNotifications: boolean
    jobFailureAlerts: boolean
    dailySummaryEmail: string
  }
  security: {
    twoFactorRequired: boolean
    allowedDomains: string[]
    sessionTimeoutMinutes: number
  }
  createdAt: string
  updatedAt: string
}

export type TenantSettingsInput = Partial<{
  general: Partial<TenantSettings["general"]>
  branding: Partial<TenantSettings["branding"]>
  channels: Partial<TenantSettings["channels"]>
  assistant: Partial<TenantSettings["assistant"]>
  team: Partial<TenantSettings["team"]>
  notifications: Partial<TenantSettings["notifications"]>
  security: Partial<TenantSettings["security"]>
}>
