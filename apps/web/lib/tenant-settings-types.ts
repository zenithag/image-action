import type { TenantBusinessVertical } from "@/lib/tenant-types"

export type TenantSettingsTeamMemberStatus = "active" | "invited" | "disabled"
export type TenantSettingsTeamMemberRole = "admin" | "operator" | "viewer"
export type TenantSegmentationProfile = TenantBusinessVertical

export type TenantSettingsTeamMember = {
  id: string
  name: string
  email: string
  role: TenantSettingsTeamMemberRole
  status: TenantSettingsTeamMemberStatus
  password?: string
  lastLoginAt?: string
}

export const DEFAULT_STUDIO_SETTINGS = {
  catalogEnabled: false,
  environmentTypes: ["Sala", "Quarto", "Cozinha", "Banheiro", "Escritório", "Área externa", "Varanda"],
  propertyContexts: ["Apartamento", "Casa", "Alto padrão", "Pequeno", "Grande", "Conjugado"],
}

export type TenantSettings = {
  studio: { catalogEnabled: boolean; environmentTypes: string[]; propertyContexts: string[] }
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
    watermarkEnabled: boolean
    watermarkText: string
    watermarkPosition: "center" | "bottom-right"
    /** Watermark size as a percentage of the default size (50-200). */
    watermarkSize: number
  }
  channels: {
    whatsappEnabled: boolean
    instagramEnabled: boolean
    telegramEnabled: boolean
    handoffMode: "manual" | "auto"
    autoSendCompositionsToWhatsapp: boolean
  }
  assistant: {
    enabled: boolean
    catalogEnabled: boolean
    assistantName: string
    welcomeMessage: string
    modelProfileId: string
    systemPrompt: string
    humanHandoffKeywords: string[]
    catalogCategories: string[]
  }
  automation: {
    defaultConversationFlowId: string
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
  segmentation: {
    profile: TenantSegmentationProfile
    editableTargets: string[]
    protectedTargets: string[]
    promptHints: string[]
    tenantCanManage: boolean
  }
  createdAt: string
  updatedAt: string
}

export type TenantSettingsInput = Partial<{
  studio: Partial<TenantSettings["studio"]>
  general: Partial<TenantSettings["general"]>
  branding: Partial<TenantSettings["branding"]>
  channels: Partial<TenantSettings["channels"]>
  assistant: Partial<TenantSettings["assistant"]>
  automation: Partial<TenantSettings["automation"]>
  team: Partial<TenantSettings["team"]>
  notifications: Partial<TenantSettings["notifications"]>
  security: Partial<TenantSettings["security"]>
  segmentation: Partial<TenantSettings["segmentation"]>
}>
