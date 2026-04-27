import { NextResponse } from "next/server"

import type { CompositionJob } from "@/lib/composition-types"
import type { InboxConversationSummary, InboxMessage } from "@/lib/inbox-types"
import { listCatalogItems } from "@/lib/server/catalog-store"
import { listCompositionJobs } from "@/lib/server/composition-jobs-store"
import { listContacts } from "@/lib/server/contacts-store"
import { listInboxConversations, listInboxMessages } from "@/lib/server/inbox-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

type RangeKey = "7d" | "30d" | "month"

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

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function resolveRange(value: string | null): RangeKey {
  return value === "30d" || value === "month" ? value : "7d"
}

function getRangeWindow(range: RangeKey) {
  const now = new Date()
  const end = new Date()

  if (range === "month") {
    const start = startOfMonth(now)
    const previousEnd = new Date(start)
    const previousStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)

    return {
      range,
      label: "Este mês",
      start,
      end,
      previousStart,
      previousEnd,
      bucketCount: Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))),
    }
  }

  const days = range === "30d" ? 30 : 7
  const start = startOfDay(now)
  start.setDate(start.getDate() - (days - 1))
  const previousEnd = new Date(start)
  const previousStart = new Date(start)
  previousStart.setDate(previousStart.getDate() - days)

  return {
    range,
    label: range === "30d" ? "Últimos 30 dias" : "Últimos 7 dias",
    start,
    end,
    previousStart,
    previousEnd,
    bucketCount: days,
  }
}

function formatDay(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
}

function createBuckets(start: Date, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const dayStart = startOfDay(start)
    dayStart.setDate(dayStart.getDate() + index)

    return {
      key: dayStart.toISOString().slice(0, 10),
      name: formatDay(dayStart),
      start: dayStart,
      end: endOfDay(dayStart),
    }
  })
}

function isWithin(dateInput: string | undefined, start: Date, end: Date) {
  if (!dateInput) return false
  const date = new Date(dateInput)
  return date >= start && date < end
}

function countDelta(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  return Math.round(((current - previous) / previous) * 100)
}

function average(numbers: number[]) {
  if (numbers.length === 0) return null
  return numbers.reduce((total, value) => total + value, 0) / numbers.length
}

function buildResponseMetrics(messagesByConversation: InboxMessage[][]) {
  const aiDelays: number[] = []
  const operatorDelays: number[] = []

  for (const messages of messagesByConversation) {
    const orderedMessages = [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    let lastCustomerTimestamp: number | null = null

    for (const message of orderedMessages) {
      const timestamp = new Date(message.createdAt).getTime()

      if (message.role === "customer") {
        lastCustomerTimestamp = timestamp
        continue
      }

      if (lastCustomerTimestamp == null) {
        continue
      }

      const delaySeconds = Math.max(0, Math.round((timestamp - lastCustomerTimestamp) / 1000))

      if (message.role === "assistant") {
        aiDelays.push(delaySeconds)
      }

      if (message.role === "operator") {
        operatorDelays.push(delaySeconds)
      }

      lastCustomerTimestamp = null
    }
  }

  const aiAverage = average(aiDelays)
  const operatorAverage = average(operatorDelays)

  return {
    aiSeconds: aiAverage != null ? Math.round(aiAverage) : null,
    operatorSeconds: operatorAverage != null ? Math.round(operatorAverage) : null,
    aiFastRate: aiDelays.length > 0 ? Math.round((aiDelays.filter((value) => value <= 5).length / aiDelays.length) * 100) : null,
    operatorFastRate: operatorDelays.length > 0 ? Math.round((operatorDelays.filter((value) => value <= 600).length / operatorDelays.length) * 100) : null,
  }
}

function formatResponseTime(seconds: number | null) {
  if (seconds == null) return null
  if (seconds < 60) return `${seconds}s`

  const minutes = seconds / 60
  if (minutes < 60) return `${minutes.toFixed(1)}min`

  const hours = minutes / 60
  return `${hours.toFixed(1)}h`
}

function mapRecentConversation(conversation: InboxConversationSummary) {
  return {
    id: conversation.id,
    contactName: conversation.contact.name,
    channelInstanceName: conversation.channelInstanceName,
    handledBy: conversation.handledBy,
    status: conversation.status,
    unreadCount: conversation.unreadCount,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
  }
}

function mapReviewJob(job: CompositionJob) {
  return {
    id: job.id,
    contactName: job.contactName,
    status: job.status,
    prompt: job.prompt,
    catalogItemName: job.catalogItemName,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params
  const { searchParams } = new URL(request.url)
  const range = resolveRange(searchParams.get("range"))
  const window = getRangeWindow(range)

  const conversations = await listInboxConversations(slug)
  const messagesByConversation = await Promise.all(
    conversations.map((conversation) => listInboxMessages(slug, conversation.id))
  )
  const messages = messagesByConversation.flat()
  const jobs = await listCompositionJobs(slug)
  const contacts = await listContacts(slug)
  const catalogItems = await listCatalogItems(slug)
  const allInstances = await readTenantInstances()
  const instances = allInstances.filter((instance) => instance.tenantSlug === slug)

  const conversationsInRange = conversations.filter((conversation) => isWithin(conversation.createdAt, window.start, window.end))
  const previousConversations = conversations.filter((conversation) => isWithin(conversation.createdAt, window.previousStart, window.previousEnd))
  const contactsInRange = contacts.filter((contact) => isWithin(contact.createdAt, window.start, window.end))
  const previousContacts = contacts.filter((contact) => isWithin(contact.createdAt, window.previousStart, window.previousEnd))
  const jobsInRange = jobs.filter((job) => isWithin(job.createdAt, window.start, window.end))
  const previousJobs = jobs.filter((job) => isWithin(job.createdAt, window.previousStart, window.previousEnd))
  const messagesInRange = messages.filter((message) => isWithin(message.createdAt, window.start, window.end))
  const previousMessages = messages.filter((message) => isWithin(message.createdAt, window.previousStart, window.previousEnd))

  const jobsByMode = jobsInRange.reduce<Record<string, number>>((acc, job) => {
    acc[job.mode] = (acc[job.mode] ?? 0) + 1
    return acc
  }, {})
  const jobsByStatus = jobsInRange.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1
    return acc
  }, {})
  const unreadMessages = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)
  const completedCompositions = jobsByStatus.done ?? 0
  const currentCompletionRate = jobsInRange.length > 0 ? Math.round((completedCompositions / jobsInRange.length) * 100) : 0
  const previousCompleted = previousJobs.filter((job) => job.status === "done").length
  const previousCompletionRate = previousJobs.length > 0 ? Math.round((previousCompleted / previousJobs.length) * 100) : 0
  const buckets = createBuckets(window.start, window.bucketCount)
  const conversationData = buckets.map((bucket) => ({
    name: bucket.name,
    conversas: conversations.filter((conversation) => isWithin(conversation.createdAt, bucket.start, bucket.end)).length,
    composicoes: jobs.filter((job) => isWithin(job.createdAt, bucket.start, bucket.end)).length,
    contatos: contacts.filter((contact) => isWithin(contact.createdAt, bucket.start, bucket.end)).length,
  }))
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const hourMessages = messagesInRange.filter((message) => new Date(message.createdAt).getHours() === hour)
    const aiMessages = hourMessages.filter((message) => message.role === "assistant").length
    const operatorMessages = hourMessages.filter((message) => message.role === "operator").length

    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      mensagens: hourMessages.length,
      ia: aiMessages,
      operador: operatorMessages,
    }
  })
  const responseMetrics = buildResponseMetrics(messagesByConversation)

  return NextResponse.json({
    meta: {
      range: window.range,
      label: window.label,
    },
    stats: {
      conversations: conversationsInRange.length,
      contacts: contactsInRange.length,
      catalogItems: catalogItems.length,
      compositions: jobsInRange.length,
      completedCompositions,
      failedCompositions: jobsByStatus.failed ?? 0,
      unreadMessages,
      connectedChannels: instances.filter((instance) => instance.connected).length,
      aiHandledConversations: conversations.filter((conversation) => conversation.handledBy === "ai").length,
      operatorHandledConversations: conversations.filter((conversation) => conversation.handledBy === "operator").length,
      messages: messagesInRange.length,
      completionRate: currentCompletionRate,
    },
    deltas: {
      conversations: countDelta(conversationsInRange.length, previousConversations.length),
      contacts: countDelta(contactsInRange.length, previousContacts.length),
      compositions: countDelta(jobsInRange.length, previousJobs.length),
      messages: countDelta(messagesInRange.length, previousMessages.length),
      completionRate: countDelta(currentCompletionRate, previousCompletionRate),
    },
    responseTimes: {
      aiSeconds: responseMetrics.aiSeconds,
      operatorSeconds: responseMetrics.operatorSeconds,
      aiLabel: formatResponseTime(responseMetrics.aiSeconds),
      operatorLabel: formatResponseTime(responseMetrics.operatorSeconds),
      aiFastRate: responseMetrics.aiFastRate,
      operatorFastRate: responseMetrics.operatorFastRate,
    },
    recentConversations: conversations
      .slice(0, 5)
      .map(mapRecentConversation),
    reviewQueue: jobs
      .filter((job) => job.status === "queued" || job.status === "processing" || job.status === "failed")
      .slice(0, 5)
      .map(mapReviewJob),
    conversationData,
    hourlyData,
    compositionModeData: [
      { name: "Interiores", value: jobsByMode.interior ?? 0, color: "#31c48d" },
      { name: "Produto", value: jobsByMode.product ?? 0, color: "#60a5fa" },
      { name: "Print", value: jobsByMode.print ?? 0, color: "#f59e0b" },
      { name: "Moda", value: jobsByMode.fashion ?? 0, color: "#f472b6" },
    ],
    jobStatusData: [
      { name: "Fila", value: jobsByStatus.queued ?? 0, color: "#94a3b8" },
      { name: "Processando", value: jobsByStatus.processing ?? 0, color: "#60a5fa" },
      { name: "Concluídas", value: jobsByStatus.done ?? 0, color: "#31c48d" },
      { name: "Falhas", value: jobsByStatus.failed ?? 0, color: "#ef4444" },
    ],
  })
}
