import type { InboxConversationSummary, InboxMessage, InboxMessageContentType } from "@/lib/inbox-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type InboxData = {
  conversations: InboxConversationSummary[]
  messages: InboxMessage[]
}

type UpsertInboundMessageInput = {
  tenantSlug: string
  channelInstanceId: string
  channelInstanceName: string
  externalContactId: string
  contactName: string
  phone?: string
  text?: string
  contentType?: InboxMessageContentType
  imageUrl?: string
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaSize?: number
  mediaDurationSeconds?: number
  providerMessageId?: string
  rawPayload: unknown
  createdAt?: string
}

type UpsertSyncedMessageInput = {
  tenantSlug: string
  channelInstanceId: string
  channelInstanceName: string
  externalContactId: string
  contactName: string
  phone?: string
  text?: string
  contentType?: InboxMessageContentType
  imageUrl?: string
  mediaUrl?: string
  mediaMimeType?: string
  mediaFileName?: string
  mediaSize?: number
  mediaDurationSeconds?: number
  providerMessageId?: string
  fromMe: boolean
  createdAt: string
  rawPayload: unknown
}

const dataFile = getRuntimeDataFile("inbox-conversations.json")
const storeKey = "inbox-conversations"
let mutationQueue = Promise.resolve()

async function withInboxMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readInboxData(): Promise<InboxData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { conversations: [], messages: [] },
    normalize: (parsed) => ({
      conversations: Array.isArray((parsed as Partial<InboxData>)?.conversations)
        ? (parsed as InboxData).conversations
        : [],
      messages: Array.isArray((parsed as Partial<InboxData>)?.messages)
        ? (parsed as InboxData).messages
        : [],
    }),
  })
}

async function writeInboxData(data: InboxData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { conversations: [], messages: [] } }, data)
}

function getConversationId(tenantSlug: string, channelInstanceId: string, externalContactId: string) {
  return `${tenantSlug}:${channelInstanceId}:${externalContactId}`.replace(/[^a-zA-Z0-9:_@.-]/g, "_")
}

function sortConversations(conversations: InboxConversationSummary[]) {
  return [...conversations].sort((left, right) =>
    new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
  )
}

function getMediaLabel(contentType: InboxMessageContentType) {
  if (contentType === "image") return "Imagem recebida"
  if (contentType === "audio") return "Audio recebido"
  if (contentType === "video") return "Video recebido"
  if (contentType === "file") return "Arquivo recebido"

  return "Mensagem recebida"
}

function getMessageContent(text: string | undefined, contentType: InboxMessageContentType) {
  const trimmedText = text?.trim()

  if (trimmedText) {
    return trimmedText
  }

  return getMediaLabel(contentType)
}

export async function listInboxConversations(tenantSlug: string) {
  const data = await readInboxData()

  return sortConversations(data.conversations.filter((conversation) => conversation.tenantSlug === tenantSlug))
}

export async function listInboxMessages(tenantSlug: string, conversationId: string) {
  const data = await readInboxData()

  return data.messages
    .filter((message) => message.tenantSlug === tenantSlug && message.conversationId === conversationId)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

export async function findInboxConversation(tenantSlug: string, conversationId: string) {
  const data = await readInboxData()

  return data.conversations.find((conversation) =>
    conversation.tenantSlug === tenantSlug && conversation.id === conversationId
  ) ?? null
}

export async function findInboxMessage(tenantSlug: string, conversationId: string, messageId: string) {
  const data = await readInboxData()

  return data.messages.find((message) =>
    message.tenantSlug === tenantSlug &&
    message.conversationId === conversationId &&
    message.id === messageId
  ) ?? null
}

export async function upsertInboundInboxMessage(input: UpsertInboundMessageInput) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const now = input.createdAt ?? new Date().toISOString()
    const conversationId = getConversationId(input.tenantSlug, input.channelInstanceId, input.externalContactId)
    const existingConversation = data.conversations.find((conversation) => conversation.id === conversationId)
    const messageExists = Boolean(
      input.providerMessageId &&
      data.messages.some((message) => message.providerMessageId === input.providerMessageId)
    )
    const contentType = input.contentType ?? (input.imageUrl || input.mediaUrl ? "image" : "text")
    const mediaUrl = input.mediaUrl ?? input.imageUrl
    const content = getMessageContent(input.text, contentType)

    const nextConversation: InboxConversationSummary = {
      id: conversationId,
      tenantSlug: input.tenantSlug,
      channelInstanceId: input.channelInstanceId,
      channelInstanceName: input.channelInstanceName,
      externalContactId: input.externalContactId,
      contact: {
        name: input.contactName || input.phone || input.externalContactId,
        phone: input.phone,
      },
      lastMessage: content,
      lastMessageAt: now,
      status: existingConversation?.handledBy === "operator" ? "waiting_operator" : "open",
      handledBy: existingConversation?.handledBy ?? "ai",
      unreadCount: (existingConversation?.unreadCount ?? 0) + (messageExists ? 0 : 1),
      state: existingConversation?.state ?? "idle",
      createdAt: existingConversation?.createdAt ?? now,
      updatedAt: now,
    }

    const nextConversations = existingConversation
      ? data.conversations.map((conversation) => conversation.id === conversationId ? nextConversation : conversation)
      : [nextConversation, ...data.conversations]

    const nextMessage: InboxMessage = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      conversationId,
      channelInstanceId: input.channelInstanceId,
      externalContactId: input.externalContactId,
      direction: "inbound",
      role: "customer",
      content,
      contentType,
      imageUrl: contentType === "image" ? mediaUrl : undefined,
      mediaUrl,
      mediaMimeType: input.mediaMimeType,
      mediaFileName: input.mediaFileName,
      mediaSize: input.mediaSize,
      mediaDurationSeconds: input.mediaDurationSeconds,
      providerMessageId: input.providerMessageId,
      rawPayload: input.rawPayload,
      createdAt: now,
    }

    await writeInboxData({
      conversations: sortConversations(nextConversations),
      messages: messageExists ? data.messages : [...data.messages, nextMessage],
    })

    return {
      conversation: nextConversation,
      message: messageExists ? null : nextMessage,
    }
  })
}

export async function upsertSyncedInboxMessage(input: UpsertSyncedMessageInput) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const conversationId = getConversationId(input.tenantSlug, input.channelInstanceId, input.externalContactId)
    const existingConversation = data.conversations.find((conversation) => conversation.id === conversationId)
    const messageExists = Boolean(
      input.providerMessageId &&
      data.messages.some((message) => message.providerMessageId === input.providerMessageId)
    )

    if (messageExists) {
      return { conversation: existingConversation ?? null, message: null, created: false }
    }

    const contentType = input.contentType ?? (input.imageUrl || input.mediaUrl ? "image" : "text")
    const mediaUrl = input.mediaUrl ?? input.imageUrl
    const content = getMessageContent(input.text, contentType)

    const message: InboxMessage = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      conversationId,
      channelInstanceId: input.channelInstanceId,
      externalContactId: input.externalContactId,
      direction: input.fromMe ? "outbound" : "inbound",
      role: input.fromMe ? "operator" : "customer",
      content,
      contentType,
      imageUrl: contentType === "image" ? mediaUrl : undefined,
      mediaUrl,
      mediaMimeType: input.mediaMimeType,
      mediaFileName: input.mediaFileName,
      mediaSize: input.mediaSize,
      mediaDurationSeconds: input.mediaDurationSeconds,
      providerMessageId: input.providerMessageId,
      rawPayload: input.rawPayload,
      status: input.fromMe ? "sent" : undefined,
      createdAt: input.createdAt,
    }

    const previousUnread = existingConversation?.unreadCount ?? 0
    const lastMessageAt = existingConversation && new Date(existingConversation.lastMessageAt) > new Date(input.createdAt)
      ? existingConversation.lastMessageAt
      : input.createdAt
    const lastMessage = lastMessageAt === input.createdAt ? content : existingConversation?.lastMessage ?? content
    const conversation: InboxConversationSummary = {
      id: conversationId,
      tenantSlug: input.tenantSlug,
      channelInstanceId: input.channelInstanceId,
      channelInstanceName: input.channelInstanceName,
      externalContactId: input.externalContactId,
      contact: {
        name: input.contactName || input.phone || input.externalContactId,
        phone: input.phone,
      },
      lastMessage,
      lastMessageAt,
      status: input.fromMe ? "waiting_customer" : existingConversation?.handledBy === "operator" ? "waiting_operator" : "open",
      handledBy: existingConversation?.handledBy ?? (input.fromMe ? "operator" : "ai"),
      unreadCount: input.fromMe ? previousUnread : previousUnread + 1,
      state: existingConversation?.state ?? "idle",
      createdAt: existingConversation?.createdAt ?? input.createdAt,
      updatedAt: new Date().toISOString(),
    }

    const conversations = existingConversation
      ? data.conversations.map((item) => item.id === conversationId ? conversation : item)
      : [conversation, ...data.conversations]

    await writeInboxData({
      conversations: sortConversations(conversations),
      messages: [...data.messages, message],
    })

    return { conversation, message, created: true }
  })
}

export async function appendOperatorInboxMessage(input: {
  tenantSlug: string
  conversationId: string
  content: string
  providerMessageId?: string
}) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const conversation = data.conversations.find((item) =>
      item.tenantSlug === input.tenantSlug && item.id === input.conversationId
    )

    if (!conversation) {
      return null
    }

    const now = new Date().toISOString()
    const message: InboxMessage = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      conversationId: conversation.id,
      channelInstanceId: conversation.channelInstanceId,
      externalContactId: conversation.externalContactId,
      direction: "outbound",
      role: "operator",
      content: input.content,
      contentType: "text",
      providerMessageId: input.providerMessageId,
      status: "sent",
      createdAt: now,
    }

    const nextConversation: InboxConversationSummary = {
      ...conversation,
      lastMessage: input.content,
      lastMessageAt: now,
      status: "waiting_customer",
      handledBy: "operator",
      unreadCount: 0,
      updatedAt: now,
    }

    await writeInboxData({
      conversations: sortConversations(
        data.conversations.map((item) => item.id === conversation.id ? nextConversation : item)
      ),
      messages: [...data.messages, message],
    })

    return { conversation: nextConversation, message }
  })
}

export async function appendAssistantInboxMessage(input: {
  tenantSlug: string
  conversationId: string
  content: string
  providerMessageId?: string
  state?: InboxConversationSummary["state"]
  handledBy?: InboxConversationSummary["handledBy"]
}) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const conversation = data.conversations.find((item) =>
      item.tenantSlug === input.tenantSlug && item.id === input.conversationId
    )

    if (!conversation) {
      return null
    }

    const now = new Date().toISOString()
    const message: InboxMessage = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      conversationId: conversation.id,
      channelInstanceId: conversation.channelInstanceId,
      externalContactId: conversation.externalContactId,
      direction: "outbound",
      role: "assistant",
      content: input.content,
      contentType: "text",
      providerMessageId: input.providerMessageId,
      status: "sent",
      createdAt: now,
    }
    const handledBy = input.handledBy ?? conversation.handledBy
    const nextConversation: InboxConversationSummary = {
      ...conversation,
      lastMessage: input.content,
      lastMessageAt: now,
      status: handledBy === "operator" ? "waiting_operator" : "waiting_customer",
      handledBy,
      unreadCount: 0,
      state: input.state ?? conversation.state,
      updatedAt: now,
    }

    await writeInboxData({
      conversations: sortConversations(
        data.conversations.map((item) => item.id === conversation.id ? nextConversation : item)
      ),
      messages: [...data.messages, message],
    })

    return { conversation: nextConversation, message }
  })
}

export async function updateInboxConversation(tenantSlug: string, conversationId: string, updates: Partial<InboxConversationSummary>) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    let updatedConversation: InboxConversationSummary | null = null

    const conversations = data.conversations.map((conversation) => {
      if (conversation.tenantSlug !== tenantSlug || conversation.id !== conversationId) {
        return conversation
      }

      updatedConversation = {
        ...conversation,
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      return updatedConversation
    })

    if (!updatedConversation) {
      return null
    }

    await writeInboxData({ ...data, conversations: sortConversations(conversations) })
    return updatedConversation
  })
}

export async function markInboxConversationRead(tenantSlug: string, conversationId: string) {
  return updateInboxConversation(tenantSlug, conversationId, {
    unreadCount: 0,
  })
}

export async function purgeInboxForChannelInstance(tenantSlug: string, channelInstanceId: string) {
  await withInboxMutation(async () => {
    const data = await readInboxData()
    await writeInboxData({
      conversations: data.conversations.filter((conversation) =>
        conversation.tenantSlug !== tenantSlug || conversation.channelInstanceId !== channelInstanceId
      ),
      messages: data.messages.filter((message) =>
        message.tenantSlug !== tenantSlug || message.channelInstanceId !== channelInstanceId
      ),
    })
  })
}

export async function purgeInboxExceptChannelInstances(tenantSlug: string, channelInstanceIds: string[]) {
  await withInboxMutation(async () => {
    const allowedIds = new Set(channelInstanceIds)
    const data = await readInboxData()

    await writeInboxData({
      conversations: data.conversations.filter((conversation) =>
        conversation.tenantSlug !== tenantSlug || allowedIds.has(conversation.channelInstanceId)
      ),
      messages: data.messages.filter((message) =>
        message.tenantSlug !== tenantSlug || allowedIds.has(message.channelInstanceId)
      ),
    })
  })
}
