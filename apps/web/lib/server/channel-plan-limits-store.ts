import type { ChannelPlanLimit } from "@/lib/channel-plan-types"
import { channelPlanOrder, defaultChannelPlanLimits } from "@/lib/channel-plan-types"
import type { TenantPlanCode } from "@/lib/tenant-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

const dataFile = getRuntimeDataFile("channel-plan-limits.json")
const storeKey = "channel-plan-limits"
const planCodes = new Set<TenantPlanCode>(channelPlanOrder)

function now() {
  return new Date().toISOString()
}

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.round(parsed))
}

function buildDefaultPlan(planCode: TenantPlanCode): ChannelPlanLimit {
  return {
    ...defaultChannelPlanLimits[planCode],
    updatedAt: now(),
  }
}

function normalizePlan(value: unknown): ChannelPlanLimit | null {
  const plan = value as Partial<ChannelPlanLimit> | null
  const planCode = plan?.planCode

  if (!planCode || !planCodes.has(planCode)) {
    return null
  }

  const defaults = defaultChannelPlanLimits[planCode]

  return {
    planCode,
    label: normalizeText(plan.label, defaults.label),
    whatsapp: normalizeNumber(plan.whatsapp, defaults.whatsapp),
    instagram: normalizeNumber(plan.instagram, defaults.instagram),
    telegram: normalizeNumber(plan.telegram, defaults.telegram),
    catalogIncluded: plan.catalogIncluded === true,
    conversationsLimit: normalizeNumber(plan.conversationsLimit, defaults.conversationsLimit),
    extra: normalizeText(plan.extra, defaults.extra),
    updatedAt: normalizeText(plan.updatedAt, now()),
  }
}

function normalizePlans(parsed: unknown) {
  const source = Array.isArray(parsed) ? parsed : []
  const plans = new Map<TenantPlanCode, ChannelPlanLimit>()

  for (const item of source) {
    const plan = normalizePlan(item)
    if (plan) {
      plans.set(plan.planCode, plan)
    }
  }

  for (const planCode of channelPlanOrder) {
    if (!plans.has(planCode)) {
      plans.set(planCode, buildDefaultPlan(planCode))
    }
  }

  return channelPlanOrder.map((planCode) => plans.get(planCode) as ChannelPlanLimit)
}

export async function readChannelPlanLimits() {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: channelPlanOrder.map((planCode) => buildDefaultPlan(planCode)),
    normalize: normalizePlans,
  })
}

export async function writeChannelPlanLimits(plans: ChannelPlanLimit[]) {
  await writeJsonStore(
    { key: storeKey, filePath: dataFile, fallback: channelPlanOrder.map((planCode) => buildDefaultPlan(planCode)) },
    normalizePlans(plans)
  )
}

export async function getChannelPlanLimitMap() {
  const plans = await readChannelPlanLimits()

  return plans.reduce<Record<TenantPlanCode, ChannelPlanLimit>>((accumulator, plan) => {
    accumulator[plan.planCode] = plan
    return accumulator
  }, {} as Record<TenantPlanCode, ChannelPlanLimit>)
}

export async function updateChannelPlanLimits(input: Array<Partial<ChannelPlanLimit> & { planCode: TenantPlanCode }>) {
  const currentPlans = await readChannelPlanLimits()
  const currentMap = currentPlans.reduce<Record<TenantPlanCode, ChannelPlanLimit>>((accumulator, plan) => {
    accumulator[plan.planCode] = plan
    return accumulator
  }, {} as Record<TenantPlanCode, ChannelPlanLimit>)

  const nextPlans = channelPlanOrder.map((planCode) => {
    const current = currentMap[planCode] ?? buildDefaultPlan(planCode)
    const patch = input.find((item) => item.planCode === planCode)

    if (!patch) {
      return current
    }

    return normalizePlan({
      ...current,
      ...patch,
      updatedAt: now(),
    }) as ChannelPlanLimit
  })

  await writeChannelPlanLimits(nextPlans)

  return nextPlans
}
