import type { TenantPlanCode } from "@/lib/tenant-types"

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

export const channelPlanOrder: TenantPlanCode[] = ["starter", "pro", "enterprise"]

export const defaultChannelPlanLimits: Record<TenantPlanCode, Omit<ChannelPlanLimit, "updatedAt">> = {
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
    label: "Enterprise",
    whatsapp: 10,
    instagram: 5,
    telegram: 5,
    catalogIncluded: false,
    conversationsLimit: 10000,
    extra: "Limite negociado",
  },
}
