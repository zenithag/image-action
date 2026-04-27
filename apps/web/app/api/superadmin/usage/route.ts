import { NextResponse } from "next/server"

import type { Tenant } from "@/lib/tenant-types"
import { listCompositionJobs } from "@/lib/server/composition-jobs-store"
import { listContacts } from "@/lib/server/contacts-store"
import { listAllInboxConversations } from "@/lib/server/inbox-store"
import { readProviders } from "@/lib/server/channel-providers-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"
import { listTenants } from "@/lib/server/tenants-store"

export const runtime = "nodejs"

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfDay(date: Date) {
  const copy = startOfDay(date)
  copy.setDate(copy.getDate() + 1)
  return copy
}

function formatDay(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
}

function createBuckets(days: number) {
  const today = startOfDay(new Date())

  return Array.from({ length: days }, (_, index) => {
    const start = new Date(today)
    start.setDate(today.getDate() - (days - 1 - index))

    return {
      key: start.toISOString().slice(0, 10),
      name: formatDay(start),
      start,
      end: endOfDay(start),
    }
  })
}

function isWithin(dateInput: string | undefined, start: Date, end: Date) {
  if (!dateInput) return false
  const date = new Date(dateInput)
  return date >= start && date < end
}

function percentDelta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  return Math.round(((current - previous) / previous) * 100)
}

export async function GET() {
  const tenants = await listTenants()
  const tenantMetrics = await Promise.all(
    tenants.map(async (tenant) => {
      const [contacts, jobs] = await Promise.all([
        listContacts(tenant.slug),
        listCompositionJobs(tenant.slug),
      ])

      return {
        tenant,
        contacts,
        jobs,
      }
    })
  )
  const [providers, instances, conversations] = await Promise.all([
    readProviders(),
    readTenantInstances(),
    listAllInboxConversations(),
  ])

  const buckets = createBuckets(7)
  const currentStart = buckets[0]?.start ?? startOfDay(new Date())
  const currentEnd = buckets[buckets.length - 1]?.end ?? endOfDay(new Date())
  const previousEnd = new Date(currentStart)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - 7)

  const conversationsCurrent = conversations.filter((conversation) => isWithin(conversation.createdAt, currentStart, currentEnd))
  const conversationsPrevious = conversations.filter((conversation) => isWithin(conversation.createdAt, previousStart, previousEnd))
  const jobsCurrent = tenantMetrics.flatMap((item) => item.jobs).filter((job) => isWithin(job.createdAt, currentStart, currentEnd))
  const jobsPrevious = tenantMetrics.flatMap((item) => item.jobs).filter((job) => isWithin(job.createdAt, previousStart, previousEnd))
  const contactsCurrent = tenantMetrics.flatMap((item) => item.contacts).filter((contact) => contact.source === "manual" && isWithin(contact.createdAt, currentStart, currentEnd))
  const contactsPrevious = tenantMetrics.flatMap((item) => item.contacts).filter((contact) => contact.source === "manual" && isWithin(contact.createdAt, previousStart, previousEnd))

  const topTenants = tenantMetrics
    .map(({ tenant, contacts, jobs }) => {
      const tenantConversations = conversations.filter((conversation) => conversation.tenantSlug === tenant.slug)
      const connectedInstances = instances.filter((instance) => instance.tenantSlug === tenant.slug && instance.connected).length

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        planCode: tenant.planCode,
        conversations: tenantConversations.length,
        compositions: jobs.length,
        contacts: contacts.length,
        connectedInstances,
      }
    })
    .sort((left, right) => right.conversations - left.conversations)
    .slice(0, 5)

  const weeklyData = buckets.map((bucket) => ({
    name: bucket.name,
    conversas: conversations.filter((conversation) => isWithin(conversation.createdAt, bucket.start, bucket.end)).length,
    composicoes: tenantMetrics.flatMap((item) => item.jobs).filter((job) => isWithin(job.createdAt, bucket.start, bucket.end)).length,
    contatos: tenantMetrics.flatMap((item) => item.contacts).filter((contact) => contact.source === "manual" && isWithin(contact.createdAt, bucket.start, bucket.end)).length,
  }))

  return NextResponse.json({
    totals: {
      tenants: tenants.length,
      conversations: conversations.length,
      compositions: tenantMetrics.flatMap((item) => item.jobs).length,
      contacts: tenantMetrics.flatMap((item) => item.contacts).length,
      connectedInstances: instances.filter((instance) => instance.connected).length,
      activeProviders: providers.filter((provider) => provider.status === "active").length,
    },
    deltas: {
      conversations: percentDelta(conversationsCurrent.length, conversationsPrevious.length),
      compositions: percentDelta(jobsCurrent.length, jobsPrevious.length),
      contacts: percentDelta(contactsCurrent.length, contactsPrevious.length),
    },
    weeklyData,
    topTenants,
    providerSummary: {
      total: providers.length,
      active: providers.filter((provider) => provider.status === "active").length,
      warning: providers.filter((provider) => provider.health === "warning").length,
      error: providers.filter((provider) => provider.health === "error").length,
    },
  })
}
