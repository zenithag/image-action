import { NextResponse } from "next/server"

import { listCatalogItems } from "@/lib/server/catalog-store"
import { listCompositionJobs } from "@/lib/server/composition-jobs-store"
import { listContacts } from "@/lib/server/contacts-store"
import { listInboxConversations, listInboxMessages } from "@/lib/server/inbox-store"
import { readTenantInstances } from "@/lib/server/tenant-channel-instances-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ slug: string }>
}

function startOfDay(date: Date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDay(date: Date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")
}

function createLastSevenDays() {
  const today = startOfDay(new Date())

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))

    return {
      key: date.toISOString().slice(0, 10),
      name: formatDay(date),
      start: date,
      end: new Date(date.getTime() + 24 * 60 * 60 * 1000),
    }
  })
}

function isWithin(dateInput: string | undefined, start: Date, end: Date) {
  if (!dateInput) return false
  const date = new Date(dateInput)
  return date >= start && date < end
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params
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
  const days = createLastSevenDays()
  const conversationData = days.map((day) => ({
    name: day.name,
    conversas: conversations.filter((conversation) => isWithin(conversation.createdAt, day.start, day.end)).length,
    composicoes: jobs.filter((job) => isWithin(job.createdAt, day.start, day.end)).length,
    contatos: contacts.filter((contact) => isWithin(contact.createdAt, day.start, day.end)).length,
  }))
  const hourlyData = Array.from({ length: 24 }, (_, hour) => {
    const hourMessages = messages.filter((message) => new Date(message.createdAt).getHours() === hour)
    const aiMessages = hourMessages.filter((message) => message.role === "assistant").length
    const operatorMessages = hourMessages.filter((message) => message.role === "operator").length

    return {
      hour: `${String(hour).padStart(2, "0")}:00`,
      mensagens: hourMessages.length,
      ia: aiMessages,
      operador: operatorMessages,
    }
  })
  const jobsByMode = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.mode] = (acc[job.mode] ?? 0) + 1
    return acc
  }, {})
  const jobsByStatus = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] ?? 0) + 1
    return acc
  }, {})
  const unreadMessages = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0)

  return NextResponse.json({
    stats: {
      conversations: conversations.length,
      contacts: contacts.length,
      catalogItems: catalogItems.length,
      compositions: jobs.length,
      completedCompositions: jobsByStatus.done ?? 0,
      failedCompositions: jobsByStatus.failed ?? 0,
      unreadMessages,
      connectedChannels: instances.filter((instance) => instance.connected).length,
      aiHandledConversations: conversations.filter((conversation) => conversation.handledBy === "ai").length,
      operatorHandledConversations: conversations.filter((conversation) => conversation.handledBy === "operator").length,
      messages: messages.length,
    },
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
      { name: "Concluidas", value: jobsByStatus.done ?? 0, color: "#31c48d" },
      { name: "Falhas", value: jobsByStatus.failed ?? 0, color: "#ef4444" },
    ],
  })
}
