import type { TenantPlanCode } from "@/lib/tenant-types"

export type ChannelPlanLimit = {
  planCode: TenantPlanCode
  label: string
  whatsapp: number
  instagram: number
  telegram: number
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
    conversationsLimit: 100,
    extra: "Compra avulsa por instancia",
  },
  pro: {
    planCode: "pro",
    label: "Pro",
    whatsapp: 3,
    instagram: 2,
    telegram: 2,
    conversationsLimit: 1000,
    extra: "Pacotes de 3 instancias",
  },
  enterprise: {
    planCode: "enterprise",
    label: "Enterprise",
    whatsapp: 10,
    instagram: 5,
    telegram: 5,
    conversationsLimit: 10000,
    extra: "Limite negociado",
  },
}
