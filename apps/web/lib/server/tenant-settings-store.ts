import { DEFAULT_STUDIO_SETTINGS } from "@/lib/tenant-settings-types"
import { normalizeWatermarkPercent } from "@/lib/watermark-layout"
import type {
  TenantSegmentationProfile,
  TenantSettings,
  TenantSettingsInput,
  TenantSettingsTeamMember,
} from "@/lib/tenant-settings-types"
import { listStoredAuthUsersForTenant, syncStoredTenantUsers } from "@/lib/server/auth-users-store"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"
import { findTenant } from "@/lib/server/tenants-store"

type SettingsData = {
  settings: TenantSettings[]
}

const dataFile = getRuntimeDataFile("tenant-settings.json")
const storeKey = "tenant-settings"
let mutationQueue = Promise.resolve()

async function withSettingsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readSettingsData(): Promise<SettingsData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { settings: [] },
    normalize: (parsed) => ({
      settings: Array.isArray((parsed as Partial<SettingsData>)?.settings)
        ? (parsed as SettingsData).settings
        : [],
    }),
  })
}

async function writeSettingsData(data: SettingsData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { settings: [] } }, data)
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function normalizeWatermarkSize(value: unknown, fallback = 100) {
  const parsed = typeof value === "number" ? value : Number(value)
  const base = Number.isFinite(parsed) ? parsed : Number.isFinite(fallback) ? fallback : 100

  return Math.min(200, Math.max(50, Math.round(base)))
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function normalizeList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean)
  }

  return normalizeText(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeUniqueList(value: unknown) {
  return [...new Set(normalizeList(value))]
}

function normalizeColor(value: unknown, fallback: string) {
  const color = normalizeText(value)
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback
}

function normalizeTeamMembers(value: unknown): TenantSettingsTeamMember[] {
  if (!Array.isArray(value)) {
    return []
  }

  const members = value
    .map((member): TenantSettingsTeamMember | null => {
      const item = member as Partial<TenantSettingsTeamMember>
      const name = normalizeText(item.name)
      const email = normalizeText(item.email).toLowerCase()

      if (!name || !email) {
        return null
      }

      return {
        id: normalizeText(item.id) || crypto.randomUUID(),
        name,
        email,
        role: item.role === "admin" || item.role === "viewer" ? item.role : "operator",
        status: item.status === "invited" || item.status === "disabled" ? item.status : "active",
        monthlyGenerationLimit: typeof item.monthlyGenerationLimit === "number" && Number.isSafeInteger(item.monthlyGenerationLimit) && item.monthlyGenerationLimit >= 0 ? item.monthlyGenerationLimit : undefined,
        lastLoginAt: normalizeText(item.lastLoginAt) || undefined,
      } satisfies TenantSettingsTeamMember
    })

  return members.filter((member): member is TenantSettingsTeamMember => member !== null)
}

async function hydrateTeamMembersFromAuth(tenantSlug: string, currentMembers: TenantSettingsTeamMember[]) {
  const users = await listStoredAuthUsersForTenant(tenantSlug)
  const currentByEmail = new Map(currentMembers.map((member) => [member.email.toLowerCase(), member] as const))

  if (users.length === 0) {
    return currentMembers
  }

  return users.map((user) => {
    const existing = currentByEmail.get(user.email.toLowerCase())
    const role = user.roles.includes("tenant_admin")
      ? "admin"
      : user.roles.includes("tenant_viewer")
        ? "viewer"
        : "operator"

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      status: user.status === "disabled" ? "disabled" : user.lastLoginAt ? "active" : existing?.status === "invited" ? "invited" : "active",
      monthlyGenerationLimit: existing?.monthlyGenerationLimit,
      lastLoginAt: user.lastLoginAt,
    } satisfies TenantSettingsTeamMember
  })
}

function normalizeSegmentationProfile(value: unknown): TenantSegmentationProfile {
  return value === "decor" || value === "fashion" || value === "automotive" || value === "furniture"
    ? value
    : "generic"
}

function defaultSegmentationByProfile(profile: TenantSegmentationProfile) {
  if (profile === "decor") {
    return {
      editableTargets: ["painted_wall", "wall_finish", "floor", "ceiling", "furniture"],
      protectedTargets: ["window", "door", "baseboard", "fixed_structure"],
      promptHints: ["all visible walls", "right wall only", "floor only", "ceiling only"],
    }
  }

  if (profile === "fashion") {
    return {
      editableTargets: ["dress", "shirt", "pants", "shoes", "bag", "accessory"],
      protectedTargets: ["face", "hair", "skin", "hands", "background"],
      promptHints: ["only the dress", "preserve skin and hair", "change fabric only"],
    }
  }

  if (profile === "automotive") {
    return {
      editableTargets: ["car_body", "hood", "door_panel", "roof", "wheel", "rim", "bumper"],
      protectedTargets: ["glass", "license_plate", "background"],
      promptHints: ["paintable body panels only", "exclude windows and plate", "change wheels only"],
    }
  }

  if (profile === "furniture") {
    return {
      editableTargets: ["sofa", "table", "chair", "cabinet", "shelf", "panel"],
      protectedTargets: ["background", "floor", "wall"],
      promptHints: ["only the sofa fabric", "replace shelf finish", "change cabinet color"],
    }
  }

  return {
    editableTargets: [],
    protectedTargets: ["background"],
    promptHints: [],
  }
}

function defaultTenantSettings(tenantSlug: string): TenantSettings {
  const now = new Date().toISOString()
  const segmentationDefaults = defaultSegmentationByProfile("generic")

  return {
    tenantSlug,
    studio: structuredClone(DEFAULT_STUDIO_SETTINGS),
    general: {
      companyName: tenantSlug,
      description: "",
      timezone: "America/Boa_Vista",
      locale: "pt-BR",
    },
    branding: {
      primaryColor: "#01cfb0",
      logoUrl: "",
      brandVoice: "",
      watermarkEnabled: true,
      watermarkText: "",
      watermarkPosition: "center",
      watermarkSize: 100,
      watermarkX: 50,
      watermarkY: 50,
      watermarkOpacity: 22,
    },
    channels: {
      whatsappEnabled: true,
      instagramEnabled: false,
      telegramEnabled: false,
      handoffMode: "manual",
      autoSendCompositionsToWhatsapp: false,
    },
    assistant: {
      enabled: true,
      catalogEnabled: true,
      assistantName: "Yá",
      welcomeMessage: "",
      modelProfileId: "conversation.default",
      systemPrompt: "",
      humanHandoffKeywords: [],
      catalogCategories: [],
    },
    automation: {
      defaultConversationFlowId: "",
    },
    team: {
      members: [],
    },
    notifications: {
      emailNotifications: false,
      whatsappNotifications: false,
      jobFailureAlerts: true,
      dailySummaryEmail: "",
    },
    security: {
      twoFactorRequired: false,
      allowedDomains: [],
      sessionTimeoutMinutes: 480,
    },
    segmentation: {
      profile: "generic",
      editableTargets: segmentationDefaults.editableTargets,
      protectedTargets: segmentationDefaults.protectedTargets,
      promptHints: segmentationDefaults.promptHints,
      tenantCanManage: false,
    },
    createdAt: now,
    updatedAt: now,
  }
}

function mergeTenantSettings(existing: TenantSettings, input: TenantSettingsInput): TenantSettings {
  const next: TenantSettings = {
    ...existing,
    studio: { ...DEFAULT_STUDIO_SETTINGS, ...existing.studio, ...input.studio },
    general: {
      ...existing.general,
      ...input.general,
    },
    branding: {
      ...existing.branding,
      ...input.branding,
    },
    channels: {
      ...existing.channels,
      ...input.channels,
    },
    assistant: {
      ...existing.assistant,
      ...input.assistant,
    },
    automation: {
      ...existing.automation,
      ...input.automation,
    },
    team: {
      ...existing.team,
      ...input.team,
    },
    notifications: {
      ...existing.notifications,
      ...input.notifications,
    },
    security: {
      ...existing.security,
      ...input.security,
    },
    segmentation: {
      ...existing.segmentation,
      ...input.segmentation,
    },
    updatedAt: new Date().toISOString(),
  }

  const segmentationProfile = normalizeSegmentationProfile(next.segmentation.profile)
  const segmentationDefaults = defaultSegmentationByProfile(segmentationProfile)

  return {
    ...next,
    studio: {
      catalogEnabled: normalizeBoolean(next.studio.catalogEnabled, existing.studio?.catalogEnabled ?? false),
      environmentTypes: normalizeUniqueList(next.studio.environmentTypes).slice(0, 30).map(value => value.slice(0, 80)),
      propertyContexts: normalizeUniqueList(next.studio.propertyContexts).slice(0, 30).map(value => value.slice(0, 80)),
    },
    general: {
      companyName: normalizeText(next.general.companyName) || existing.tenantSlug,
      description: normalizeText(next.general.description),
      timezone: normalizeText(next.general.timezone) || "America/Boa_Vista",
      locale: normalizeText(next.general.locale) || "pt-BR",
    },
    branding: {
      primaryColor: normalizeColor(next.branding.primaryColor, existing.branding.primaryColor || "#01cfb0"),
      logoUrl: normalizeText(next.branding.logoUrl),
      brandVoice: normalizeText(next.branding.brandVoice),
      watermarkEnabled: normalizeBoolean(next.branding.watermarkEnabled, existing.branding.watermarkEnabled),
      watermarkText: normalizeText(next.branding.watermarkText),
      watermarkPosition: next.branding.watermarkPosition === "custom" ? "custom" : next.branding.watermarkPosition === "bottom-right" ? "bottom-right" : "center",
      watermarkX: normalizeWatermarkPercent(next.branding.watermarkX, existing.branding.watermarkX ?? 50),
      watermarkY: normalizeWatermarkPercent(next.branding.watermarkY, existing.branding.watermarkY ?? 50),
      watermarkOpacity: normalizeWatermarkPercent(next.branding.watermarkOpacity, existing.branding.watermarkOpacity ?? 22),
      watermarkSize: normalizeWatermarkSize(next.branding.watermarkSize, existing.branding.watermarkSize),
    },
    channels: {
      whatsappEnabled: normalizeBoolean(next.channels.whatsappEnabled, existing.channels.whatsappEnabled),
      instagramEnabled: normalizeBoolean(next.channels.instagramEnabled, existing.channels.instagramEnabled),
      telegramEnabled: normalizeBoolean(next.channels.telegramEnabled, existing.channels.telegramEnabled),
      handoffMode: next.channels.handoffMode === "auto" ? "auto" : "manual",
      autoSendCompositionsToWhatsapp: normalizeBoolean(
        next.channels.autoSendCompositionsToWhatsapp,
        existing.channels.autoSendCompositionsToWhatsapp
      ),
    },
    assistant: {
      enabled: normalizeBoolean(next.assistant.enabled, existing.assistant.enabled),
      catalogEnabled: normalizeBoolean(next.assistant.catalogEnabled, existing.assistant.catalogEnabled ?? true),
      assistantName: normalizeText(next.assistant.assistantName) || "Yá",
      welcomeMessage: normalizeText(next.assistant.welcomeMessage),
      modelProfileId: normalizeText(next.assistant.modelProfileId) || "conversation.default",
      systemPrompt: normalizeText(next.assistant.systemPrompt),
      humanHandoffKeywords: normalizeUniqueList(next.assistant.humanHandoffKeywords),
      catalogCategories: normalizeUniqueList(next.assistant.catalogCategories),
    },
    automation: {
      defaultConversationFlowId: normalizeText(next.automation.defaultConversationFlowId),
    },
    team: {
      members: normalizeTeamMembers(next.team.members),
    },
    notifications: {
      emailNotifications: normalizeBoolean(next.notifications.emailNotifications, existing.notifications.emailNotifications),
      whatsappNotifications: normalizeBoolean(next.notifications.whatsappNotifications, existing.notifications.whatsappNotifications),
      jobFailureAlerts: normalizeBoolean(next.notifications.jobFailureAlerts, existing.notifications.jobFailureAlerts),
      dailySummaryEmail: normalizeText(next.notifications.dailySummaryEmail).toLowerCase(),
    },
    security: {
      twoFactorRequired: normalizeBoolean(next.security.twoFactorRequired, existing.security.twoFactorRequired),
      allowedDomains: normalizeList(next.security.allowedDomains),
      sessionTimeoutMinutes: normalizeNumber(next.security.sessionTimeoutMinutes, existing.security.sessionTimeoutMinutes, 15, 10080),
    },
    segmentation: {
      profile: segmentationProfile,
      editableTargets: normalizeList(next.segmentation.editableTargets).length > 0
        ? normalizeList(next.segmentation.editableTargets)
        : segmentationDefaults.editableTargets,
      protectedTargets: normalizeList(next.segmentation.protectedTargets).length > 0
        ? normalizeList(next.segmentation.protectedTargets)
        : segmentationDefaults.protectedTargets,
      promptHints: normalizeList(next.segmentation.promptHints).length > 0
        ? normalizeList(next.segmentation.promptHints)
        : segmentationDefaults.promptHints,
      tenantCanManage: normalizeBoolean(next.segmentation.tenantCanManage, existing.segmentation.tenantCanManage),
    },
  }
}

export async function getTenantSettings(tenantSlug: string) {
  const data = await readSettingsData()
  const existing = data.settings.find((settings) => settings.tenantSlug === tenantSlug)
  const baseSettings = existing
    ? mergeTenantSettings(defaultTenantSettings(tenantSlug), existing)
    : defaultTenantSettings(tenantSlug)

  const tenant = await findTenant(tenantSlug)
  const companyName = baseSettings.general.companyName

  return {
    ...baseSettings,
    general: {
      ...baseSettings.general,
      companyName: !companyName || companyName === tenantSlug
        ? tenant?.name || tenantSlug.replace(/[-_]+/g, " ")
        : companyName,
    },
    team: {
      members: await hydrateTeamMembersFromAuth(tenantSlug, baseSettings.team.members),
    },
  }
}

export async function updateTenantSettings(tenantSlug: string, input: TenantSettingsInput) {
  return withSettingsMutation(async () => {
    const data = await readSettingsData()
    const existing = data.settings.find((settings) => settings.tenantSlug === tenantSlug) ?? defaultTenantSettings(tenantSlug)
    const tenant = await findTenant(tenantSlug)

    if (!tenant) {
      throw new Error("Tenant nao encontrado.")
    }

    let updated = mergeTenantSettings(existing, input)

    if (input.team?.members) {
      const syncMembers = input.team.members
        .map((member): {
          id?: string
          name: string
          email: string
          role: "admin" | "operator" | "viewer"
          status: "active" | "invited" | "disabled"
          password?: string
        } | null => {
          const item = member as Partial<TenantSettingsTeamMember>
          const name = normalizeText(item.name)
          const email = normalizeText(item.email).toLowerCase()

          if (!name || !email) {
            return null
          }

          return {
            id: normalizeText(item.id) || undefined,
            name,
            email,
            role: item.role === "admin" || item.role === "viewer" ? item.role : "operator",
            status: item.status === "disabled" ? "disabled" : item.status === "invited" ? "invited" : "active",
            password: normalizeText(item.password) || undefined,
          }
        })
        .filter((member): member is {
          id?: string
          name: string
          email: string
          role: "admin" | "operator" | "viewer"
          status: "active" | "invited" | "disabled"
          password?: string
        } => member !== null)

      const syncedUsers = await syncStoredTenantUsers({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        members: syncMembers,
        allowedDomains: updated.security.allowedDomains,
      })

      updated = {
        ...updated,
        team: {
          members: syncedUsers.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.roles.includes("tenant_admin") ? "admin" : user.roles.includes("tenant_viewer") ? "viewer" : "operator",
            status: user.status === "disabled" ? "disabled" : user.lastLoginAt ? "active" : "invited",
            monthlyGenerationLimit: updated.team.members.find(member => member.email.toLowerCase() === user.email.toLowerCase())?.monthlyGenerationLimit,
            lastLoginAt: user.lastLoginAt,
          })),
        },
      }
    }

    const exists = data.settings.some((settings) => settings.tenantSlug === tenantSlug)

    await writeSettingsData({
      settings: exists
        ? data.settings.map((settings) => settings.tenantSlug === tenantSlug ? updated : settings)
        : [updated, ...data.settings],
    })

    return {
      ...updated,
      team: {
        members: await hydrateTeamMembersFromAuth(tenantSlug, updated.team.members),
      },
    }
  })
}
