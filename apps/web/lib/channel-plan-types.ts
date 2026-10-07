import type { BuiltInTenantPlanCode, TenantPlanCode } from "@/lib/tenant-types"

export type ChannelPlanLimit = {
  planCode: TenantPlanCode
  label: string
  whatsapp: number
  instagram: number
  telegram: number
  catalogIncluded: boolean
  conversationsLimit: number
  extra: string
  updatedAt: string
}

export const channelPlanOrder: BuiltInTenantPlanCode[] = ["starter", "pro", "enterprise", "custom"]

export const defaultChannelPlanLimits: Record<BuiltInTenantPlanCode, Omit<ChannelPlanLimit, "updatedAt">> = {
  starter: {
    planCode: "starter",
    label: "Starter",
    whatsapp: 1,
    instagram: 1,
    telegram: 1,
    catalogIncluded: false,
    conversationsLimit: 100,
    extra: "Compra avulsa por instancia",
  },
  pro: {
    planCode: "pro",
    label: "Pro",
    whatsapp: 3,
    instagram: 2,
    telegram: 2,
    catalogIncluded: false,
    conversationsLimit: 1000,
    extra: "Pacotes de 3 instancias",
  },
  enterprise: {
    planCode: "enterprise",
    label: "Advanced",
    whatsapp: 10,
    instagram: 5,
    telegram: 5,
    catalogIncluded: false,
    conversationsLimit: 10000,
    extra: "Limite negociado",
  },
  custom: {
    planCode: "custom",
    label: "Personalizado",
    whatsapp: 0,
    instagram: 0,
    telegram: 0,
    catalogIncluded: false,
    conversationsLimit: 0,
    extra: "Limites definidos para este cliente",
  },
}
