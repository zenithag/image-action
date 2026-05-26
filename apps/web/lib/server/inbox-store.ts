import type {
  InboxCompositionSession,
  InboxCompositionSessionChange,
  InboxCompositionSessionImage,
  InboxCompositionSessionProduct,
  InboxCompositionSessionStep,
  InboxConversationSummary,
  InboxMessage,
  InboxMessageContentType,
} from "@/lib/inbox-types"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { publishInboxRealtime } from "@/lib/server/inbox-realtime"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"
import { readTenantInstances, type StoredTenantChannelInstance } from "@/lib/server/tenant-channel-instances-store"

type InboxData = {
  conversations: InboxConversationSummary[]
  messages: InboxMessage[]
  deletedConversations: DeletedInboxConversationCutoff[]
}

type DeletedInboxConversationCutoff = {
  tenantSlug: string
  channelInstanceId: string
  externalContactId: string
  deletedAt: string
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
    fallback: { conversations: [], messages: [], deletedConversations: [] },
    normalize: (parsed) => ({
      conversations: Array.isArray((parsed as Partial<InboxData>)?.conversations)
        ? (parsed as InboxData).conversations
        : [],
      messages: Array.isArray((parsed as Partial<InboxData>)?.messages)
        ? (parsed as InboxData).messages
        : [],
      deletedConversations: Array.isArray((parsed as Partial<InboxData>)?.deletedConversations)
        ? (parsed as InboxData).deletedConversations.filter(isDeletedConversationCutoff)
        : [],
    }),
  })
}

function isDeletedConversationCutoff(value: unknown): value is DeletedInboxConversationCutoff {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.tenantSlug === "string" &&
    typeof value.channelInstanceId === "string" &&
    typeof value.externalContactId === "string" &&
    typeof value.deletedAt === "string"
  )
}

function getChannelKey(tenantSlug: string, channelInstanceId: string) {
  return `${tenantSlug}:${channelInstanceId}`
}

function getDeletedConversationKey(item: Pick<DeletedInboxConversationCutoff, "tenantSlug" | "channelInstanceId" | "externalContactId">) {
  return `${item.tenantSlug}:${item.channelInstanceId}:${item.externalContactId}`
}

function getDeletedConversationCutoffTime(
  data: InboxData,
  item: Pick<DeletedInboxConversationCutoff, "tenantSlug" | "channelInstanceId" | "externalContactId">,
) {
  const key = getDeletedConversationKey(item)
  const cutoff = data.deletedConversations
    .filter((deleted) => getDeletedConversationKey(deleted) === key)
    .map((deleted) => new Date(deleted.deletedAt).getTime())
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0]

  return cutoff ?? 0
}

function isAfterDeletedConversationCutoff(
  data: InboxData,
  item: Pick<DeletedInboxConversationCutoff, "tenantSlug" | "channelInstanceId" | "externalContactId"> & { createdAt: string },
) {
  const cutoff = getDeletedConversationCutoffTime(data, item)

  return cutoff <= 0 || getMessageTimestamp(item) > cutoff
}

async function getChannelCutoffTimes() {
  const instances = await readTenantInstances()
  const cutoffs = new Map<string, number>()

  for (const instance of instances) {
    const cutoff = instance.syncStartedAt ?? instance.createdAt
    const cutoffTime = new Date(cutoff).getTime()

    if (Number.isFinite(cutoffTime)) {
      cutoffs.set(getChannelKey(instance.tenantSlug, instance.id), cutoffTime)
    }
  }

  return cutoffs
}

function isVisibleAfterConnection(
  item: { tenantSlug: string; channelInstanceId: string; createdAt: string; rawPayload?: unknown },
  cutoffs: Map<string, number>,
) {
  if (isHistoryMessage(item)) {
    return false
  }

  const cutoff = cutoffs.get(getChannelKey(item.tenantSlug, item.channelInstanceId))

  return !cutoff || getMessageTimestamp(item) >= cutoff
}

function applyConnectionCutoffs(data: InboxData, cutoffs: Map<string, number>): InboxData {
  const messages = data.messages.filter((message) =>
    isVisibleAfterConnection(message, cutoffs) &&
    isAfterDeletedConversationCutoff(data, message)
  )
  const messagesByConversation = new Map<string, InboxMessage[]>()

  for (const message of messages) {
    const current = messagesByConversation.get(message.conversationId) ?? []
    current.push(message)
    messagesByConversation.set(message.conversationId, current)
  }

  const conversations = data.conversations.flatMap((conversation) => {
    const cutoff = cutoffs.get(getChannelKey(conversation.tenantSlug, conversation.channelInstanceId))

    if (!cutoff) {
      return [conversation]
    }

    const conversationMessages = messagesByConversation.get(conversation.id) ?? []

    if (conversationMessages.length === 0) {
      return []
    }

    const latestMessage = [...conversationMessages].sort((left, right) =>
      getMessageTimestamp(right) - getMessageTimestamp(left)
    )[0]

    return [{
      ...conversation,
      lastMessage: latestMessage.content,
      lastMessageAt: latestMessage.createdAt,
      unreadCount: Math.min(
        conversation.unreadCount,
        conversationMessages.filter((message) => message.direction === "inbound").length,
      ),
    }]
  })

  return {
    conversations,
    messages,
    deletedConversations: data.deletedConversations,
  }
}

async function readVisibleInboxData() {
  const [data, cutoffs] = await Promise.all([
    readInboxData(),
    getChannelCutoffTimes(),
  ])

  return applyConnectionCutoffs(data, cutoffs)
}

export async function listAllInboxConversations() {
  const data = await readVisibleInboxData()
  return sortConversations(data.conversations)
}

export async function listAllInboxMessages() {
  const data = await readVisibleInboxData()
  return [...data.messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

async function writeInboxData(data: InboxData) {
  await writeJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { conversations: [], messages: [], deletedConversations: [] },
  }, data)
}

function getConversationId(tenantSlug: string, channelInstanceId: string, externalContactId: string) {
  return `${tenantSlug}:${channelInstanceId}:${externalContactId}`.replace(/[^a-zA-Z0-9:_@.-]/g, "_")
}

function sortConversations(conversations: InboxConversationSummary[]) {
  return [...conversations].sort((left, right) =>
    new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime()
  )
}

export function createEmptyInboxCompositionSession(now = new Date().toISOString()): InboxCompositionSession {
  return {
    step: "idle",
    selectedProducts: [],
    changes: [],
    updatedAt: now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeSessionStep(value: unknown): InboxCompositionSessionStep {
  if (
    value === "idle" ||
    value === "browsing_catalog" ||
    value === "product_selected" ||
    value === "awaiting_reference_image" ||
    value === "awaiting_base_image" ||
    value === "awaiting_base_choice" ||
    value === "composing" ||
    value === "completed"
  ) {
    return value
  }

  return "idle"
}

function normalizeSessionImage(value: unknown): InboxCompositionSessionImage | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const kind = value.kind === "result"
    ? "result"
    : value.kind === "reference"
      ? "reference"
      : value.kind === "base"
        ? "base"
        : undefined
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : undefined

  if (!kind || !createdAt) {
    return undefined
  }

  return {
    kind,
    messageId: typeof value.messageId === "string" ? value.messageId : undefined,
    jobId: typeof value.jobId === "string" ? value.jobId : undefined,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    label: typeof value.label === "string" ? value.label : undefined,
    createdAt,
  }
}

function normalizeSessionProduct(value: unknown): InboxCompositionSessionProduct | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) {
    return null
  }

  return {
    id: typeof value.id === "string" ? value.id : undefined,
    sku: typeof value.sku === "string" ? value.sku : undefined,
    name: value.name.trim(),
    category: typeof value.category === "string" ? value.category : undefined,
    color: typeof value.color === "string" ? value.color : undefined,
  }
}

function normalizeSessionChange(value: unknown): InboxCompositionSessionChange | null {
  if (!isRecord(value) || typeof value.prompt !== "string" || typeof value.createdAt !== "string") {
    return null
  }

  const base = value.base === "original" || value.base === "result" || value.base === "new_upload"
    ? value.base
    : "unspecified"
  const status = value.status === "queued" || value.status === "done" || value.status === "failed"
    ? value.status
    : "pending"

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    prompt: value.prompt,
    product: normalizeSessionProduct(value.product) ?? undefined,
    base,
    jobId: typeof value.jobId === "string" ? value.jobId : undefined,
    status,
    createdAt: value.createdAt,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
  }
}

export function normalizeInboxCompositionSession(value: unknown): InboxCompositionSession {
  if (!isRecord(value)) {
    return createEmptyInboxCompositionSession()
  }

  const selectedProducts = Array.isArray(value.selectedProducts)
    ? value.selectedProducts
      .map(normalizeSessionProduct)
      .filter((item): item is InboxCompositionSessionProduct => Boolean(item))
    : []
  const changes = Array.isArray(value.changes)
    ? value.changes
      .map(normalizeSessionChange)
      .filter((item): item is InboxCompositionSessionChange => Boolean(item))
    : []

  return {
    step: normalizeSessionStep(value.step),
    baseImage: normalizeSessionImage(value.baseImage),
    referenceImage: normalizeSessionImage(value.referenceImage),
    workingImage: normalizeSessionImage(value.workingImage),
    preferredBase: value.preferredBase === "original" || value.preferredBase === "result" ? value.preferredBase : undefined,
    selectedProducts,
    pendingPrompt: typeof value.pendingPrompt === "string" ? value.pendingPrompt : undefined,
    pendingBaseChoice: value.pendingBaseChoice === true,
    changes,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
  }
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
  const data = await readVisibleInboxData()

  return sortConversations(data.conversations.filter((conversation) => conversation.tenantSlug === tenantSlug))
}

export async function listInboxMessages(tenantSlug: string, conversationId: string) {
  const data = await readVisibleInboxData()

  return data.messages
    .filter((message) => message.tenantSlug === tenantSlug && message.conversationId === conversationId)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

export async function findInboxConversation(tenantSlug: string, conversationId: string) {
  const data = await readVisibleInboxData()

  return data.conversations.find((conversation) =>
    conversation.tenantSlug === tenantSlug && conversation.id === conversationId
  ) ?? null
}

export async function findInboxMessage(tenantSlug: string, conversationId: string, messageId: string) {
  const data = await readVisibleInboxData()

  return data.messages.find((message) =>
    message.tenantSlug === tenantSlug &&
    message.conversationId === conversationId &&
    message.id === messageId
  ) ?? null
}

export async function deleteInboxConversation(tenantSlug: string, conversationId: string) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const conversation = data.conversations.find((item) =>
      item.tenantSlug === tenantSlug && item.id === conversationId
    )

    if (!conversation) {
      return null
    }

    const deletedAt = new Date().toISOString()
    const deletedConversation: DeletedInboxConversationCutoff = {
      tenantSlug: conversation.tenantSlug,
      channelInstanceId: conversation.channelInstanceId,
      externalContactId: conversation.externalContactId,
      deletedAt,
    }
    const deletedKey = getDeletedConversationKey(deletedConversation)

    await writeInboxData({
      conversations: data.conversations.filter((item) =>
        !(item.tenantSlug === tenantSlug && item.id === conversationId)
      ),
      messages: data.messages.filter((message) =>
        !(message.tenantSlug === tenantSlug && message.conversationId === conversationId)
      ),
      deletedConversations: [
        deletedConversation,
        ...data.deletedConversations.filter((item) => getDeletedConversationKey(item) !== deletedKey),
      ],
    })

    publishInboxRealtime({
      type: "conversation_deleted",
      tenantSlug,
      conversationId,
    })

    return conversation
  })
}

export async function assignInboxConversationToChannelInstance(
  tenantSlug: string,
  conversationId: string,
  instance: StoredTenantChannelInstance,
) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const conversation = data.conversations.find((item) =>
      item.tenantSlug === tenantSlug && item.id === conversationId
    )

    if (!conversation) {
      return { ok: false as const, reason: "not_found" as const }
    }

    const duplicatedConversation = data.conversations.find((item) =>
      item.tenantSlug === tenantSlug &&
      item.id !== conversationId &&
      item.channelInstanceId === instance.id &&
      item.externalContactId === conversation.externalContactId
    )

    if (duplicatedConversation) {
      return {
        ok: false as const,
        reason: "duplicate" as const,
        conversation: duplicatedConversation,
      }
    }

    const now = new Date().toISOString()
    const updatedConversation: InboxConversationSummary = {
      ...conversation,
      channelInstanceId: instance.id,
      channelInstanceName: instance.name,
      handledBy: "operator",
      status: "waiting_operator",
      updatedAt: now,
    }

    await writeInboxData({
      ...data,
      conversations: sortConversations(
        data.conversations.map((item) => item.id === conversationId ? updatedConversation : item)
      ),
    })

    publishInboxRealtime({
      type: "conversation_updated",
      tenantSlug,
      conversationId,
      conversation: updatedConversation,
    })

    return { ok: true as const, conversation: updatedConversation }
  })
}

export async function upsertInboundInboxMessage(input: UpsertInboundMessageInput) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    const now = input.createdAt ?? new Date().toISOString()

    if (!isAfterDeletedConversationCutoff(data, { ...input, createdAt: now })) {
      return { conversation: null, message: null }
    }

    const generatedConversationId = getConversationId(input.tenantSlug, input.channelInstanceId, input.externalContactId)
    const existingConversation = data.conversations.find((conversation) =>
      conversation.id === generatedConversationId ||
      (
        conversation.tenantSlug === input.tenantSlug &&
        conversation.channelInstanceId === input.channelInstanceId &&
        conversation.externalContactId === input.externalContactId
      )
    )
    const conversationId = existingConversation?.id ?? generatedConversationId
    const messageExists = Boolean(
      input.providerMessageId &&
      data.messages.some((message) => message.providerMessageId === input.providerMessageId)
    )
    const contentType = input.contentType ?? (input.imageUrl || input.mediaUrl ? "image" : "text")
    const mediaUrl = input.mediaUrl ?? input.imageUrl
    const content = getMessageContent(input.text, contentType)

    const handledBy = existingConversation?.handledBy ?? "operator"
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
      status: handledBy === "operator" ? "waiting_operator" : "open",
      handledBy,
      unreadCount: (existingConversation?.unreadCount ?? 0) + (messageExists ? 0 : 1),
      state: existingConversation?.state ?? "idle",
      contextResetAt: existingConversation?.contextResetAt,
      compositionSession: existingConversation?.compositionSession,
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
      deletedConversations: data.deletedConversations,
    })

    if (!messageExists) {
      publishInboxRealtime({
        type: "message_created",
        tenantSlug: input.tenantSlug,
        conversationId,
        conversation: nextConversation,
        message: nextMessage,
      })
    }

    return {
      conversation: nextConversation,
      message: messageExists ? null : nextMessage,
    }
  })
}

export async function upsertSyncedInboxMessage(input: UpsertSyncedMessageInput) {
  return withInboxMutation(async () => {
    const data = await readInboxData()

    if (!isAfterDeletedConversationCutoff(data, input)) {
      return { conversation: null, message: null, created: false }
    }

    const generatedConversationId = getConversationId(input.tenantSlug, input.channelInstanceId, input.externalContactId)
    const existingConversation = data.conversations.find((conversation) =>
      conversation.id === generatedConversationId ||
      (
        conversation.tenantSlug === input.tenantSlug &&
        conversation.channelInstanceId === input.channelInstanceId &&
        conversation.externalContactId === input.externalContactId
      )
    )
    const conversationId = existingConversation?.id ?? generatedConversationId
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
    const handledBy = existingConversation?.handledBy ?? "operator"
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
      status: input.fromMe ? "waiting_customer" : handledBy === "operator" ? "waiting_operator" : "open",
      handledBy,
      unreadCount: input.fromMe ? previousUnread : previousUnread + 1,
      state: existingConversation?.state ?? "idle",
      contextResetAt: existingConversation?.contextResetAt,
      compositionSession: existingConversation?.compositionSession,
      createdAt: existingConversation?.createdAt ?? input.createdAt,
      updatedAt: new Date().toISOString(),
    }

    const conversations = existingConversation
      ? data.conversations.map((item) => item.id === conversationId ? conversation : item)
      : [conversation, ...data.conversations]

    await writeInboxData({
      conversations: sortConversations(conversations),
      messages: [...data.messages, message],
      deletedConversations: data.deletedConversations,
    })

    publishInboxRealtime({
      type: "message_created",
      tenantSlug: input.tenantSlug,
      conversationId,
      conversation,
      message,
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
      deletedConversations: data.deletedConversations,
    })

    publishInboxRealtime({
      type: "message_created",
      tenantSlug: input.tenantSlug,
      conversationId: conversation.id,
      conversation: nextConversation,
      message,
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
      deletedConversations: data.deletedConversations,
    })

    publishInboxRealtime({
      type: "message_created",
      tenantSlug: input.tenantSlug,
      conversationId: conversation.id,
      conversation: nextConversation,
      message,
    })

    return { conversation: nextConversation, message }
  })
}

export async function appendAssistantInboxMediaMessage(input: {
  tenantSlug: string
  conversationId: string
  content?: string
  contentType: InboxMessageContentType
  mediaUrl: string
  mediaMimeType?: string
  mediaFileName?: string
  providerMessageId?: string
  status?: InboxMessage["status"]
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
    const content = input.content?.trim() || getMediaLabel(input.contentType)
    const message: InboxMessage = {
      id: crypto.randomUUID(),
      tenantSlug: input.tenantSlug,
      conversationId: conversation.id,
      channelInstanceId: conversation.channelInstanceId,
      externalContactId: conversation.externalContactId,
      direction: "outbound",
      role: "assistant",
      content,
      contentType: input.contentType,
      imageUrl: input.contentType === "image" ? input.mediaUrl : undefined,
      mediaUrl: input.mediaUrl,
      mediaMimeType: input.mediaMimeType,
      mediaFileName: input.mediaFileName,
      providerMessageId: input.providerMessageId,
      status: input.status ?? (input.providerMessageId ? "sent" : "failed"),
      createdAt: now,
    }
    const handledBy = input.handledBy ?? conversation.handledBy
    const nextConversation: InboxConversationSummary = {
      ...conversation,
      lastMessage: content,
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
      deletedConversations: data.deletedConversations,
    })

    publishInboxRealtime({
      type: "message_created",
      tenantSlug: input.tenantSlug,
      conversationId: conversation.id,
      conversation: nextConversation,
      message,
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

    publishInboxRealtime({
      type: "conversation_updated",
      tenantSlug,
      conversationId,
      conversation: updatedConversation,
    })

    return updatedConversation
  })
}

export async function updateInboxMessage(
  tenantSlug: string,
  conversationId: string,
  messageId: string,
  updates: Partial<Pick<InboxMessage, "providerMessageId" | "status" | "mediaUrl" | "imageUrl" | "content">>,
) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    let updatedMessage: InboxMessage | null = null

    const messages = data.messages.map((message) => {
      if (
        message.tenantSlug !== tenantSlug ||
        message.conversationId !== conversationId ||
        message.id !== messageId
      ) {
        return message
      }

      updatedMessage = {
        ...message,
        ...updates,
      }

      return updatedMessage
    })

    if (!updatedMessage) {
      return null
    }

    await writeInboxData({ ...data, messages })

    publishInboxRealtime({
      type: "message_updated",
      tenantSlug,
      conversationId,
      message: updatedMessage,
    })

    return updatedMessage
  })
}

export async function updateInboxConversationCompositionSession(
  tenantSlug: string,
  conversationId: string,
  updater: (session: InboxCompositionSession, conversation: InboxConversationSummary) => InboxCompositionSession
) {
  return withInboxMutation(async () => {
    const data = await readInboxData()
    let updatedConversation: InboxConversationSummary | null = null

    const conversations = data.conversations.map((conversation) => {
      if (conversation.tenantSlug !== tenantSlug || conversation.id !== conversationId) {
        return conversation
      }

      const nextSession = updater(
        normalizeInboxCompositionSession(conversation.compositionSession),
        conversation,
      )

      updatedConversation = {
        ...conversation,
        compositionSession: {
          ...nextSession,
          updatedAt: new Date().toISOString(),
        },
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

export async function resetInboxConversationContext(tenantSlug: string, conversationId: string) {
  return updateInboxConversation(tenantSlug, conversationId, {
    contextResetAt: new Date().toISOString(),
    compositionSession: createEmptyInboxCompositionSession(),
    state: "idle",
    status: "open",
    unreadCount: 0,
  })
}

function getMessageTimestamp(message: { createdAt: string }) {
  const timestamp = new Date(message.createdAt).getTime()

  return Number.isFinite(timestamp) ? timestamp : 0
}

function getPayloadText(payload: unknown, key: string) {
  if (!isRecord(payload)) {
    return ""
  }

  const value = payload[key]

  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

function isHistoryMessage(message: { rawPayload?: unknown }) {
  const rawPayload = message.rawPayload
  const data = isRecord(rawPayload) ? rawPayload.data : undefined

  return (
    getPayloadText(rawPayload, "EventType") === "history" ||
    getPayloadText(data, "EventType") === "history" ||
    getPayloadText(rawPayload, "eventType") === "history" ||
    getPayloadText(data, "eventType") === "history" ||
    getPayloadText(rawPayload, "event") === "history" ||
    getPayloadText(data, "event") === "history"
  )
}

export async function pruneInboxBeforeChannelInstanceTime(
  tenantSlug: string,
  channelInstanceId: string,
  cutoffIso: string,
) {
  return withInboxMutation(async () => {
    const cutoffTime = new Date(cutoffIso).getTime()

    if (!Number.isFinite(cutoffTime)) {
      return { removedMessages: 0, removedConversations: 0 }
    }

    const data = await readInboxData()
    const shouldPruneMessage = (message: InboxMessage) =>
      message.tenantSlug === tenantSlug &&
      message.channelInstanceId === channelInstanceId &&
      (getMessageTimestamp(message) < cutoffTime || isHistoryMessage(message))

    const messages = data.messages.filter((message) => !shouldPruneMessage(message))
    const remainingMessagesByConversation = new Map<string, InboxMessage[]>()

    for (const message of messages) {
      if (message.tenantSlug !== tenantSlug || message.channelInstanceId !== channelInstanceId) {
        continue
      }

      const current = remainingMessagesByConversation.get(message.conversationId) ?? []
      current.push(message)
      remainingMessagesByConversation.set(message.conversationId, current)
    }

    let removedConversations = 0
    const conversations = data.conversations.flatMap((conversation) => {
      if (conversation.tenantSlug !== tenantSlug || conversation.channelInstanceId !== channelInstanceId) {
        return [conversation]
      }

      const conversationMessages = remainingMessagesByConversation.get(conversation.id) ?? []

      if (conversationMessages.length === 0) {
        removedConversations += 1
        return []
      }

      const latestMessage = [...conversationMessages].sort((left, right) =>
        getMessageTimestamp(right) - getMessageTimestamp(left)
      )[0]

      return [{
        ...conversation,
        lastMessage: latestMessage.content,
        lastMessageAt: latestMessage.createdAt,
        unreadCount: Math.min(
          conversation.unreadCount,
          conversationMessages.filter((message) => message.direction === "inbound").length,
        ),
        updatedAt: new Date().toISOString(),
      }]
    })

    const removedMessages = data.messages.length - messages.length

    if (removedMessages > 0 || removedConversations > 0) {
      await writeInboxData({
        conversations: sortConversations(conversations),
        messages,
        deletedConversations: data.deletedConversations,
      })
    }

    return { removedMessages, removedConversations }
  })
}
