import type {
  ConversationFlowContentItem,
  ConversationFlowEdge,
  ConversationFlowGraph,
  ConversationFlowMenuAnswer,
  ConversationFlowNode,
  ConversationFlowSession,
} from "@/lib/conversation-flow-types"
import type { CompositionMode } from "@/lib/composition-types"
import type { InboxMessage } from "@/lib/inbox-types"
import { enqueueAdvanceConversationFlow, enqueueProcessCompositionQueue, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { readProviders } from "@/lib/server/channel-providers-store"
import { ensureCompositionBaseSnapshot } from "@/lib/server/composition-base-snapshots"
import { createCompositionJob } from "@/lib/server/composition-jobs-store"
import {
  appendAssistantInboxMediaMessage,
  appendAssistantInboxMessage,
  findInboxConversation,
  updateInboxConversationCompositionSession,
  updateInboxConversation,
} from "@/lib/server/inbox-store"
import {
  createConversationFlowSession,
  findConversationFlow,
  findConversationFlowVersion,
  findRunningConversationFlowSession,
  getConversationFlowSession,
  logConversationFlowEvent,
  setConversationFlowSessionStatus,
  updateConversationFlowSession,
} from "@/lib/server/conversation-flows-store"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import { findTenantInstance } from "@/lib/server/tenant-channel-instances-store"
import { sendUazapiImage, sendUazapiText } from "@/lib/server/uazapi-client"

type AdvanceResult =
  | "continue"
  | "waiting"
  | "scheduled"
  | "completed"
  | "switched"

type FlowInboundInput = {
  text: string
  message?: InboxMessage
}

const MAX_STEPS_PER_ADVANCE = 40

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

function getProviderMessageId(payload: unknown) {
  if (typeof payload !== "object" || !payload) {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const id = record.id ?? record.messageid ?? record.messageId

  return typeof id === "string" ? id : undefined
}

function nodeById(graph: ConversationFlowGraph, nodeId?: string | null) {
  return graph.nodes.find((node) => node.id === nodeId) ?? null
}

function outgoingEdges(graph: ConversationFlowGraph, source: string) {
  return graph.edges.filter((edge) => edge.source === source && Boolean(edge.target))
}

function nextNodeId(graph: ConversationFlowGraph, source: string, handle?: string | null) {
  const edges = outgoingEdges(graph, source)

  if (handle !== undefined && handle !== null) {
    return edges.find((edge) => (edge.sourceHandle ?? "") === handle)?.target ?? null
  }

  return edges.find((edge) => !edge.sourceHandle)?.target ?? edges[0]?.target ?? null
}

function isRunning(session: ConversationFlowSession) {
  return session.status === "active" || session.status === "waiting"
}

function isImageCaptureNode(node?: ConversationFlowNode | null) {
  return node?.type === "scenario_image" || node?.type === "reference_image"
}

function isInputNode(node?: ConversationFlowNode | null) {
  return node?.type === "menu" || node?.type === "text_input" || isImageCaptureNode(node)
}

function getNestedRecord(root: Record<string, unknown>, key: string) {
  const current = root[key]
  if (typeof current === "object" && current !== null && !Array.isArray(current)) {
    return current as Record<string, unknown>
  }

  const next: Record<string, unknown> = {}
  root[key] = next
  return next
}

function setContextPath(context: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean)
  let target = context

  for (const part of parts.slice(0, -1)) {
    target = getNestedRecord(target, part)
  }

  const last = parts.at(-1)
  if (last) {
    target[last] = value
  }
}

function getContextPath(context: Record<string, unknown>, path: string) {
  let current: unknown = context

  for (const part of path.split(".").filter(Boolean)) {
    current = asRecord(current)[part]
  }

  return current
}

function forgetContextPath(context: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean)
  let target: unknown = context

  for (const part of parts.slice(0, -1)) {
    target = asRecord(target)[part]
  }

  const last = parts.at(-1)
  if (last && typeof target === "object" && target !== null && !Array.isArray(target)) {
    delete (target as Record<string, unknown>)[last]
  }
}

function getTags(session: ConversationFlowSession) {
  const tags = session.context.tags
  return Array.isArray(tags) ? tags.map(String) : []
}

function withTag(session: ConversationFlowSession, tag: string) {
  return {
    ...session.context,
    tags: [...new Set([...getTags(session), tag].filter(Boolean))],
  }
}

function withoutTag(session: ConversationFlowSession, tag: string) {
  return {
    ...session.context,
    tags: getTags(session).filter((item) => item !== tag),
  }
}

function contentText(content: ConversationFlowContentItem) {
  if (content.type === "contact") {
    return [content.name || "Contato", content.phone].filter(Boolean).join("\n")
  }

  return content.text ?? content.caption ?? ""
}

function isDelayContent(content: ConversationFlowContentItem) {
  return content.type === "delay" || content.type === "wait" || content.type === "typing"
}

function canConsumeUserInput(session: ConversationFlowSession, graph: ConversationFlowGraph) {
  if (session.status !== "waiting") {
    return true
  }

  const node = nodeById(graph, session.awaitingNodeId || session.currentNodeId)
  return isInputNode(node)
}

function normalizeInboundInput(input?: string | InboxMessage | FlowInboundInput | null): FlowInboundInput | null {
  if (input === undefined || input === null) {
    return null
  }

  if (typeof input === "string") {
    return { text: input }
  }

  if ("text" in input && !("content" in input)) {
    return {
      text: input.text,
      message: input.message,
    }
  }

  const message = input as InboxMessage
  return {
    text: message.content,
    message,
  }
}

function shouldResumeWaitingNode(session: ConversationFlowSession) {
  const awaitingNodeId = session.awaitingNodeId ?? ""
  const currentNodeId = session.currentNodeId ?? ""

  return Boolean(
    getContextPath(session.context, `content_sequences.${awaitingNodeId}.pending`) ||
    getContextPath(session.context, `smart_delays.${currentNodeId}.pending`)
  )
}

function contextAfterTimedResume(session: ConversationFlowSession) {
  const context = { ...session.context }
  const currentNodeId = session.currentNodeId ?? ""
  const awaitingNodeId = session.awaitingNodeId ?? ""

  if (getContextPath(context, `smart_delays.${currentNodeId}.pending`)) {
    setContextPath(context, `smart_delays.${currentNodeId}.pending`, false)
    setContextPath(context, `smart_delays.${currentNodeId}.completed`, true)
  }

  if (getContextPath(context, `content_sequences.${awaitingNodeId}.pending`)) {
    setContextPath(context, `content_sequences.${awaitingNodeId}.pending`, false)
    setContextPath(context, `content_sequences.${awaitingNodeId}.last_resumed_at`, new Date().toISOString())
  }

  return context
}

function menuPrompt(node: ConversationFlowNode) {
  const question = asString(node.data.question) || "Escolha uma opção:"
  const answers = Array.isArray(node.data.answers) ? node.data.answers : []
  const options = answers
    .map((answer, index) => `${index + 1}. ${answer.label || `Opção ${index + 1}`}`)
    .join("\n")

  return [question, options].filter(Boolean).join("\n\n")
}

function matchMenuAnswer(node: ConversationFlowNode, input: string): ConversationFlowMenuAnswer | null {
  const normalized = normalizeSearchText(input)
  const answers = Array.isArray(node.data.answers) ? node.data.answers : []

  for (const [index, answer] of answers.entries()) {
    const id = answer.id || `answer_${index + 1}`
    const label = normalizeSearchText(answer.label || "")

    if (normalized === String(index + 1) || normalized === normalizeSearchText(id) || (label && normalized === label)) {
      return { id, label: answer.label || `Opção ${index + 1}` }
    }
  }

  return null
}

function imageCapturePrompt(node: ConversationFlowNode) {
  const configured = asString(node.data.question)
  if (configured) return configured

  return node.type === "scenario_image"
    ? "Envie uma foto do ambiente/cenário que será usado como base da composição."
    : "Envie a imagem de referência do produto, material, cor ou estilo que deseja aplicar."
}

function imageCaptureInvalidText(node: ConversationFlowNode) {
  const configured = asString(node.data.invalid_text)
  if (configured) return configured

  return node.type === "scenario_image"
    ? "Preciso de uma imagem do cenário para continuar. Envie uma foto do ambiente."
    : "Preciso de uma imagem de referência para continuar. Envie a foto do produto, material, cor ou estilo."
}

function getInboundImageUrl(message?: InboxMessage) {
  if (!message || message.contentType !== "image") {
    return ""
  }

  return message.mediaUrl || message.imageUrl || ""
}

function getImageCaptureLabels(node: ConversationFlowNode) {
  if (node.type === "scenario_image") {
    return {
      kind: "base" as const,
      label: "imagem do cenário",
      sessionStep: "awaiting_reference_image" as const,
      conversationState: "awaiting_base_image" as const,
      contextPath: "composition.base_image",
      eventType: "scenario_image_received",
    }
  }

  return {
    kind: "reference" as const,
    label: "imagem de referência",
    sessionStep: "product_selected" as const,
    conversationState: "collecting_preferences" as const,
    contextPath: "composition.reference_image",
    eventType: "reference_image_received",
  }
}

function normalizeCompositionMode(value: unknown): CompositionMode {
  return value === "product" || value === "print" || value === "fashion" ? value : "interior"
}

function buildFlowCompositionPrompt(session: ConversationFlowSession, node: ConversationFlowNode) {
  const configuredPrompt = asString(node.data.prompt)
  const preference = asString(getContextPath(session.context, "composition.preference"))
  const menuAnswer = asRecord(session.context.last_menu_answer)
  const menuLabel = asString(menuAnswer.label)

  return [
    configuredPrompt || "Criar uma composição visual realista aplicando a referência enviada sobre o cenário.",
    preference ? `Preferência do cliente: ${preference}.` : "",
    menuLabel ? `Direção escolhida no fluxo: ${menuLabel}.` : "",
    "Preserve enquadramento, iluminação, perspectiva e estrutura fixa do ambiente. Use a referência apenas como produto, material, cor, textura ou estilo a aplicar.",
  ].filter(Boolean).join("\n")
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null
  if (typeof value !== "string") return null

  const normalized = normalizeSearchText(value)
  if (["1", "true", "sim", "yes", "y"].includes(normalized)) return true
  if (["0", "false", "nao", "não", "no", "n", ""].includes(normalized)) return false

  return null
}

function valuesEqual(actual: unknown, expected: unknown) {
  const actualBoolean = booleanValue(actual)
  const expectedBoolean = booleanValue(expected)

  if (actualBoolean !== null || expectedBoolean !== null) {
    return actualBoolean === expectedBoolean
  }

  return String(actual ?? "") === String(expected ?? "")
}

async function getConditionActualValue(session: ConversationFlowSession, field: string) {
  const conversation = await findInboxConversation(session.tenantSlug, session.conversationId)

  if (field === "tags") return getTags(session)
  if (field === "last_user_message") return session.context.last_user_message ?? session.lastUserMessage ?? ""
  if (field === "handled_by") return conversation?.handledBy
  if (field === "state") return conversation?.state
  if (field === "status") return conversation?.status
  if (field === "contact_name") return conversation?.contact.name
  if (field === "phone") return conversation?.contact.phone
  if (field.startsWith("context.")) return getContextPath(session.context, field.replace(/^context\./, ""))

  return getContextPath(session.context, field)
}

async function conditionMatches(session: ConversationFlowSession, condition: NonNullable<ConversationFlowNode["data"]["conditions"]>[number]) {
  const operator = condition.operator || "equals"
  const actual = await getConditionActualValue(session, condition.field || "last_user_message")
  const expected = condition.value

  if (operator === "contains") {
    return Array.isArray(actual)
      ? actual.includes(expected)
      : normalizeSearchText(String(actual ?? "")).includes(normalizeSearchText(String(expected ?? "")))
  }

  if (operator === "not_contains") {
    return Array.isArray(actual)
      ? !actual.includes(expected)
      : !normalizeSearchText(String(actual ?? "")).includes(normalizeSearchText(String(expected ?? "")))
  }

  if (operator === "not_equals") return !valuesEqual(actual, expected)
  if (operator === "filled") return Array.isArray(actual) ? actual.length > 0 : String(actual ?? "").trim() !== ""
  if (operator === "blank") return Array.isArray(actual) ? actual.length === 0 : String(actual ?? "").trim() === ""
  if (operator === "true") return booleanValue(actual) === true
  if (operator === "false") return booleanValue(actual) === false

  return valuesEqual(actual, expected)
}

async function sendContent(session: ConversationFlowSession, content: ConversationFlowContentItem) {
  const conversation = await findInboxConversation(session.tenantSlug, session.conversationId)
  const instance = await findTenantInstance(session.tenantSlug, session.channelInstanceId)
  const providers = await readProviders()
  const provider = instance ? providers.find((item) => item.id === instance.providerId) : null

  if (!conversation || !instance || !provider) {
    throw new Error("Canal da conversa nao encontrado para envio do fluxo.")
  }

  if (content.type === "image" && content.url) {
    const sentPayload = await sendUazapiImage(provider, instance.instanceToken, conversation.externalContactId, content.url, content.caption, instance.externalName || instance.name)
    await appendAssistantInboxMediaMessage({
      tenantSlug: session.tenantSlug,
      conversationId: session.conversationId,
      content: content.caption || "Imagem enviada",
      contentType: "image",
      mediaUrl: content.url,
      providerMessageId: getProviderMessageId(sentPayload),
      handledBy: "ai",
    })
    return
  }

  const text = contentText(content)

  if (!text) {
    return
  }

  const sentPayload = await sendUazapiText(provider, instance.instanceToken, conversation.externalContactId, text)
  await appendAssistantInboxMessage({
    tenantSlug: session.tenantSlug,
    conversationId: session.conversationId,
    content: text,
    providerMessageId: getProviderMessageId(sentPayload),
    handledBy: "ai",
  })
}

async function scheduleSession(session: ConversationFlowSession, input: {
  nodeId: string
  resumeNodeId?: string | null
  seconds: number
  context: Record<string, unknown>
  eventType: string
  payload?: Record<string, unknown>
}) {
  const runAt = new Date(Date.now() + Math.max(1, input.seconds) * 1000)
  await updateConversationFlowSession(session.id, {
    status: "waiting",
    currentNodeId: input.nodeId,
    awaitingNodeId: input.resumeNodeId ?? input.nodeId,
    waitingSinceAt: new Date().toISOString(),
    expiresAt: runAt.toISOString(),
    context: input.context,
  })
  await enqueueAdvanceConversationFlow({ sessionId: session.id }, { runAt })
  scheduleAppJobProcessing()
  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: input.nodeId,
    type: input.eventType,
    payload: {
      seconds: input.seconds,
      scheduledAt: runAt.toISOString(),
      ...input.payload,
    },
  })
}

async function moveToNode(session: ConversationFlowSession, nodeId: string | null) {
  if (!nodeId) {
    await setConversationFlowSessionStatus(session.id, "completed", "finished")
    await logConversationFlowEvent({
      tenantSlug: session.tenantSlug,
      sessionId: session.id,
      flowId: session.flowId,
      conversationId: session.conversationId,
      type: "session_completed",
      payload: { reason: "finished" },
    })
    return "completed" as const
  }

  await updateConversationFlowSession(session.id, {
    currentNodeId: nodeId,
    status: "active",
    awaitingNodeId: null,
    waitingSinceAt: null,
    expiresAt: null,
    lastUserMessage: null,
  })

  return "continue" as const
}

async function handleContent(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode): Promise<AdvanceResult> {
  const nodeId = node.id
  const contents = Array.isArray(node.data.contents) ? node.data.contents : []
  const startIndex = Math.max(0, asNumber(getContextPath(session.context, `content_sequences.${nodeId}.next_index`), 0))

  for (let index = startIndex; index < contents.length; index += 1) {
    const content = contents[index]

    if (isDelayContent(content)) {
      const type = content.type
      const seconds = Math.max(1, asNumber(content.seconds, type === "typing" ? 3 : 5))
      const context = { ...session.context }
      setContextPath(context, `content_sequences.${nodeId}`, {
        pending: true,
        type,
        next_index: index + 1,
      })
      await scheduleSession(session, {
        nodeId,
        seconds,
        context,
        eventType: type === "typing" ? "typing_scheduled" : "content_delay_scheduled",
      })
      return "scheduled"
    }

    await sendContent(session, content)
  }

  if (getContextPath(session.context, `content_sequences.${nodeId}`)) {
    const context = { ...session.context }
    forgetContextPath(context, `content_sequences.${nodeId}`)
    await updateConversationFlowSession(session.id, { context })
  }

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId,
    type: "content_sent",
  })

  return moveToNode(session, nextNodeId(graph, node.id))
}

async function handleMenu(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode, input?: string | null): Promise<AdvanceResult> {
  if (!input && !session.lastUserMessage) {
    await sendContent(session, { type: "text", text: menuPrompt(node) })
    const timeoutMinutes = Math.max(0, asNumber(node.data.timeout_minutes, 0))
    const expiresAt = timeoutMinutes > 0 ? new Date(Date.now() + timeoutMinutes * 60_000) : null

    await updateConversationFlowSession(session.id, {
      status: "waiting",
      awaitingNodeId: node.id,
      waitingSinceAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
    })

    if (expiresAt) {
      await enqueueAdvanceConversationFlow({ sessionId: session.id }, { runAt: expiresAt })
      scheduleAppJobProcessing()
    }

    await logConversationFlowEvent({
      tenantSlug: session.tenantSlug,
      sessionId: session.id,
      flowId: session.flowId,
      conversationId: session.conversationId,
      nodeId: node.id,
      type: "menu_sent",
    })

    return "waiting"
  }

  const answer = matchMenuAnswer(node, input ?? session.lastUserMessage ?? "")

  if (!answer) {
    const context = { ...session.context }
    const errorPath = `menu_errors.${node.id}`
    const errors = asNumber(getContextPath(context, errorPath), 0) + 1
    const maxErrors = Math.max(0, asNumber(node.data.max_errors, 3))
    setContextPath(context, errorPath, errors)

    await sendContent(session, { type: "text", text: asString(node.data.invalid_text) || "Digite uma opção válida." })

    if (maxErrors > 0 && errors >= maxErrors) {
      await setConversationFlowSessionStatus(session.id, "completed", "menu_error_limit")
      return "completed"
    }

    await updateConversationFlowSession(session.id, {
      status: "waiting",
      awaitingNodeId: node.id,
      waitingSinceAt: new Date().toISOString(),
      context,
      lastUserMessage: null,
    })

    return "waiting"
  }

  await updateConversationFlowSession(session.id, {
    context: {
      ...session.context,
      last_menu_answer: answer,
    },
    lastUserMessage: null,
  })

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "menu_answered",
    payload: { answer },
  })

  return moveToNode(session, nextNodeId(graph, node.id, answer.id))
}

async function handleTextInput(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode, input?: FlowInboundInput | null): Promise<AdvanceResult> {
  if (!input && !session.lastUserMessage) {
    await sendContent(session, { type: "text", text: asString(node.data.question) || "Descreva como quer continuar." })
    const timeoutMinutes = Math.max(0, asNumber(node.data.timeout_minutes, 0))
    const expiresAt = timeoutMinutes > 0 ? new Date(Date.now() + timeoutMinutes * 60_000) : null

    await updateConversationFlowSession(session.id, {
      status: "waiting",
      awaitingNodeId: node.id,
      waitingSinceAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
    })

    if (expiresAt) {
      await enqueueAdvanceConversationFlow({ sessionId: session.id }, { runAt: expiresAt })
      scheduleAppJobProcessing()
    }

    await logConversationFlowEvent({
      tenantSlug: session.tenantSlug,
      sessionId: session.id,
      flowId: session.flowId,
      conversationId: session.conversationId,
      nodeId: node.id,
      type: "text_input_requested",
    })

    return "waiting"
  }

  const value = asString(input?.text ?? session.lastUserMessage)
  const minLength = Math.max(1, asNumber(node.data.min_length, 2))
  const isTextMessage = !input?.message || input.message.contentType === "text"

  if (!isTextMessage || value.length < minLength) {
    const context = { ...session.context }
    const errorPath = `text_input_errors.${node.id}`
    setContextPath(context, errorPath, asNumber(getContextPath(context, errorPath), 0) + 1)
    await sendContent(session, {
      type: "text",
      text: asString(node.data.invalid_text) || "Me envie uma descrição em texto para continuar.",
    })
    await updateConversationFlowSession(session.id, {
      status: "waiting",
      awaitingNodeId: node.id,
      waitingSinceAt: new Date().toISOString(),
      context,
      lastUserMessage: null,
    })

    return "waiting"
  }

  const field = asString(node.data.field) || "text_input"
  const context = { ...session.context }
  setContextPath(context, field, value)
  setContextPath(context, "last_text_input", {
    nodeId: node.id,
    field,
    value,
  })

  await updateConversationFlowSession(session.id, {
    context,
    lastUserMessage: null,
  })

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "text_input_received",
    payload: { field, value },
  })

  return moveToNode(session, nextNodeId(graph, node.id))
}

async function handleImageCapture(
  session: ConversationFlowSession,
  graph: ConversationFlowGraph,
  node: ConversationFlowNode,
  input?: FlowInboundInput | null,
): Promise<AdvanceResult> {
  const labels = getImageCaptureLabels(node)

  if (!input?.message) {
    await sendContent(session, { type: "text", text: imageCapturePrompt(node) })

    const timeoutMinutes = Math.max(0, asNumber(node.data.timeout_minutes, 0))
    const expiresAt = timeoutMinutes > 0 ? new Date(Date.now() + timeoutMinutes * 60_000) : null

    await updateInboxConversationCompositionSession(session.tenantSlug, session.conversationId, (compositionSession) => ({
      ...compositionSession,
      step: node.type === "scenario_image" ? "awaiting_base_image" : "awaiting_reference_image",
    }))
    await updateInboxConversation(session.tenantSlug, session.conversationId, {
      state: labels.conversationState,
      handledBy: "ai",
      status: "waiting_customer",
      unreadCount: 0,
    })
    await updateConversationFlowSession(session.id, {
      status: "waiting",
      awaitingNodeId: node.id,
      waitingSinceAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
    })

    if (expiresAt) {
      await enqueueAdvanceConversationFlow({ sessionId: session.id }, { runAt: expiresAt })
      scheduleAppJobProcessing()
    }

    await logConversationFlowEvent({
      tenantSlug: session.tenantSlug,
      sessionId: session.id,
      flowId: session.flowId,
      conversationId: session.conversationId,
      nodeId: node.id,
      type: "image_capture_requested",
      payload: { role: labels.kind },
    })

    return "waiting"
  }

  const imageUrl = getInboundImageUrl(input.message)

  if (!imageUrl) {
    const context = { ...session.context }
    const errorPath = `image_capture_errors.${node.id}`
    setContextPath(context, errorPath, asNumber(getContextPath(context, errorPath), 0) + 1)

    await sendContent(session, { type: "text", text: imageCaptureInvalidText(node) })
    await updateConversationFlowSession(session.id, {
      status: "waiting",
      awaitingNodeId: node.id,
      waitingSinceAt: new Date().toISOString(),
      context,
      lastUserMessage: null,
    })

    return "waiting"
  }

  const capturedImage = {
    kind: labels.kind,
    messageId: input.message.id,
    imageUrl,
    label: labels.label,
    createdAt: new Date().toISOString(),
  }
  const context = { ...session.context }
  setContextPath(context, labels.contextPath, capturedImage)

  await updateInboxConversationCompositionSession(session.tenantSlug, session.conversationId, (compositionSession) => ({
    ...compositionSession,
    step: labels.sessionStep,
    pendingImagePair: undefined,
    pendingBaseChoice: false,
    pendingPrompt: undefined,
    ...(labels.kind === "base"
      ? {
        baseImage: capturedImage,
        referenceImage: undefined,
        workingImage: undefined,
        preferredBase: undefined,
        selectedProducts: [],
      }
      : { referenceImage: capturedImage }),
  }))
  await updateInboxConversation(session.tenantSlug, session.conversationId, {
    state: labels.kind === "base" ? "collecting_preferences" : "showing_options",
    handledBy: "ai",
    status: "open",
    unreadCount: 0,
  })
  await updateConversationFlowSession(session.id, {
    context,
    lastUserMessage: null,
  })
  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: labels.eventType,
    payload: { messageId: input.message.id, imageUrl },
  })

  return moveToNode(session, nextNodeId(graph, node.id))
}

async function handleAction(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode): Promise<AdvanceResult> {
  const action = node.data.action || "set_context"

  if (action === "set_ai") {
    await updateInboxConversation(session.tenantSlug, session.conversationId, { handledBy: "ai", status: "open" })
  } else if (action === "set_operator") {
    await updateInboxConversation(session.tenantSlug, session.conversationId, { handledBy: "operator", status: "waiting_operator" })
  } else if (action === "set_state") {
    const state = asString(node.data.state)
    if (state) {
      await updateInboxConversation(session.tenantSlug, session.conversationId, { state: state as never })
    }
  } else if (action === "add_context_tag") {
    const tag = asString(node.data.tag)
    if (tag) {
      await updateConversationFlowSession(session.id, { context: withTag(session, tag) })
    }
  } else if (action === "remove_context_tag") {
    const tag = asString(node.data.tag)
    if (tag) {
      await updateConversationFlowSession(session.id, { context: withoutTag(session, tag) })
    }
  } else if (action === "set_context") {
    const field = asString(node.data.field)
    if (field) {
      const context = { ...session.context }
      setContextPath(context, field, node.data.value ?? "")
      await updateConversationFlowSession(session.id, { context })
    }
  } else if (action === "complete_conversation") {
    await updateInboxConversation(session.tenantSlug, session.conversationId, { status: "closed" })
  }

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "action_executed",
    payload: { action },
  })

  return moveToNode(session, nextNodeId(graph, node.id))
}

async function handleCondition(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode): Promise<AdvanceResult> {
  const conditions = Array.isArray(node.data.conditions) ? node.data.conditions : []

  for (const condition of conditions) {
    if (await conditionMatches(session, condition)) {
      await logConversationFlowEvent({
        tenantSlug: session.tenantSlug,
        sessionId: session.id,
        flowId: session.flowId,
        conversationId: session.conversationId,
        nodeId: node.id,
        type: "condition_matched",
        payload: { handle: condition.handle },
      })

      return moveToNode(session, nextNodeId(graph, node.id, condition.handle))
    }
  }

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "condition_unmatched",
  })

  return moveToNode(session, nextNodeId(graph, node.id, "false"))
}

async function handleFlowConnection(session: ConversationFlowSession, node: ConversationFlowNode): Promise<AdvanceResult> {
  const targetFlowId = asString(node.data.flow_id)
  const conversation = await findInboxConversation(session.tenantSlug, session.conversationId)

  if (!targetFlowId || !conversation) {
    await setConversationFlowSessionStatus(session.id, "completed", "flow_connection_missing")
    return "completed"
  }

  await setConversationFlowSessionStatus(session.id, "completed", "connected_to_flow")
  const nextSession = await startConversationFlow({
    tenantSlug: session.tenantSlug,
    conversationId: session.conversationId,
    flowId: targetFlowId,
  })

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "flow_connected",
    payload: { targetFlowId, nextSessionId: nextSession?.id },
  })

  return "switched"
}

async function handleRandomizer(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode): Promise<AdvanceResult> {
  const edges = outgoingEdges(graph, node.id)

  if (edges.length === 0) {
    await setConversationFlowSessionStatus(session.id, "completed", "randomizer_without_edges")
    return "completed"
  }

  const edge = edges[Math.floor(Math.random() * edges.length)] as ConversationFlowEdge

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "randomizer_selected",
    payload: { targetNodeId: edge.target, edgesCount: edges.length },
  })

  return moveToNode(session, edge.target)
}

async function handleSmartDelay(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode): Promise<AdvanceResult> {
  const seconds = Math.max(1, asNumber(node.data.seconds, 5))
  const resumeNodeId = nextNodeId(graph, node.id)

  if (!resumeNodeId) {
    await setConversationFlowSessionStatus(session.id, "completed", "delay_without_next")
    return "completed"
  }

  const context = { ...session.context }
  setContextPath(context, `smart_delays.${node.id}`, {
    pending: true,
    resume_node_id: resumeNodeId,
  })

  await scheduleSession(session, {
    nodeId: node.id,
    resumeNodeId,
    seconds,
    context,
    eventType: "delay_scheduled",
    payload: { targetNodeId: resumeNodeId },
  })

  return "scheduled"
}

async function handleCreateComposition(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode): Promise<AdvanceResult> {
  const conversation = await findInboxConversation(session.tenantSlug, session.conversationId)
  const compositionSession = conversation?.compositionSession
  const baseImage = compositionSession?.baseImage
  const referenceImage = compositionSession?.referenceImage

  if (!conversation || !baseImage?.imageUrl && !baseImage?.messageId) {
    await sendContent(session, {
      type: "text",
      text: "Ainda preciso da imagem do cenário para gerar a composição.",
    })
    await setConversationFlowSessionStatus(session.id, "completed", "composition_missing_base_image")
    return "completed"
  }

  if (!referenceImage?.imageUrl && !referenceImage?.messageId) {
    await sendContent(session, {
      type: "text",
      text: "Ainda preciso da imagem de referência para gerar a composição.",
    })
    await setConversationFlowSessionStatus(session.id, "completed", "composition_missing_reference_image")
    return "completed"
  }

  const result = await createCompositionJob(session.tenantSlug, {
    conversationId: conversation.id,
    channelInstanceId: conversation.channelInstanceId,
    contactName: conversation.contact.name,
    contactPhone: conversation.contact.phone,
    mode: normalizeCompositionMode(node.data.mode),
    source: "ai",
    sourceMessageId: `${session.id}:${node.id}`,
    baseMessageId: baseImage.messageId,
    baseImageUrl: baseImage.imageUrl,
    referenceMessageId: referenceImage.messageId,
    referenceImageUrl: referenceImage.imageUrl,
    references: [{
      source: "inbox",
      messageId: referenceImage.messageId,
      imageUrl: referenceImage.imageUrl,
    }],
    changeStrength: asNumber(node.data.changeStrength, 70),
    prompt: buildFlowCompositionPrompt(session, node),
  })
  const job = result.created
    ? await ensureCompositionBaseSnapshot(result.job).catch(() => result.job)
    : result.job

  await updateInboxConversationCompositionSession(session.tenantSlug, session.conversationId, (current) => ({
    ...current,
    step: "composing",
    changes: [
      ...current.changes,
      {
        id: crypto.randomUUID(),
        prompt: job.prompt,
        base: "original",
        jobId: job.id,
        status: job.status === "failed" ? "failed" : "queued",
        createdAt: new Date().toISOString(),
      },
    ],
  }))
  await updateInboxConversation(session.tenantSlug, session.conversationId, {
    state: "composing",
    handledBy: "ai",
    status: "waiting_customer",
    unreadCount: 0,
  })

  if (job.status === "queued") {
    await enqueueProcessCompositionQueue(session.tenantSlug)
    scheduleAppJobProcessing()
  }

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    nodeId: node.id,
    type: "composition_job_created",
    payload: { jobId: job.id, created: result.created },
  })

  return moveToNode(session, nextNodeId(graph, node.id))
}

async function handleNode(session: ConversationFlowSession, graph: ConversationFlowGraph, node: ConversationFlowNode, input?: FlowInboundInput | null): Promise<AdvanceResult> {
  if (node.type === "start" || node.type === "content") {
    return handleContent(session, graph, node)
  }

  if (node.type === "menu") {
    return handleMenu(session, graph, node, input?.text)
  }

  if (node.type === "text_input") {
    return handleTextInput(session, graph, node, input)
  }

  if (isImageCaptureNode(node)) {
    return handleImageCapture(session, graph, node, input)
  }

  if (node.type === "action") {
    return handleAction(session, graph, node)
  }

  if (node.type === "condition") {
    return handleCondition(session, graph, node)
  }

  if (node.type === "flow_connection") {
    return handleFlowConnection(session, node)
  }

  if (node.type === "randomizer") {
    return handleRandomizer(session, graph, node)
  }

  if (node.type === "smart_delay") {
    return handleSmartDelay(session, graph, node)
  }

  if (node.type === "create_composition") {
    return handleCreateComposition(session, graph, node)
  }

  return moveToNode(session, nextNodeId(graph, node.id))
}

export async function advanceConversationFlowSession(sessionId: string, input?: string | InboxMessage | FlowInboundInput | null) {
  let session = await getConversationFlowSession(sessionId)
  let inboundInput = normalizeInboundInput(input)

  if (!session || !isRunning(session)) {
    return session
  }

  const version = await findConversationFlowVersion(session.tenantSlug, session.flowVersionId)

  if (!version) {
    await setConversationFlowSessionStatus(session.id, "failed", "missing_version")
    return getConversationFlowSession(session.id)
  }

  if (inboundInput) {
    if (!canConsumeUserInput(session, version.graph)) {
      return session
    }

    session = await updateConversationFlowSession(session.id, {
      status: "active",
      lastUserMessage: inboundInput.text,
      currentNodeId: session.awaitingNodeId || session.currentNodeId,
      awaitingNodeId: null,
      waitingSinceAt: null,
      expiresAt: null,
      context: {
        ...session.context,
        last_user_message: inboundInput.text,
      },
    })
  } else if (session.status === "waiting" && session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime()

    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return session
    }

    if (shouldResumeWaitingNode(session)) {
      session = await updateConversationFlowSession(session.id, {
        status: "active",
        currentNodeId: session.awaitingNodeId,
        awaitingNodeId: null,
        waitingSinceAt: null,
        expiresAt: null,
        context: contextAfterTimedResume(session),
      })
    } else {
      const timeoutTarget = nextNodeId(version.graph, session.awaitingNodeId || session.currentNodeId || "", "timeout")

      if (!timeoutTarget) {
        await setConversationFlowSessionStatus(session.id, "completed", "menu_timeout")
        return getConversationFlowSession(session.id)
      }

      session = await updateConversationFlowSession(session.id, {
        status: "active",
        currentNodeId: timeoutTarget,
        awaitingNodeId: null,
        waitingSinceAt: null,
        expiresAt: null,
      })
    }
  }

  if (!session) {
    return null
  }

  for (let step = 0; step < MAX_STEPS_PER_ADVANCE; step += 1) {
    session = await getConversationFlowSession(session.id)

    if (!session || !isRunning(session)) {
      return session
    }

    const node = nodeById(version.graph, session.currentNodeId)

    if (!node) {
      await setConversationFlowSessionStatus(session.id, "completed", "missing_node")
      return getConversationFlowSession(session.id)
    }

    try {
      const result = await handleNode(session, version.graph, node, inboundInput)

      if (result !== "continue") {
        return getConversationFlowSession(session.id)
      }
    } catch (error) {
      await setConversationFlowSessionStatus(session.id, "failed", "node_failed")
      await logConversationFlowEvent({
        tenantSlug: session.tenantSlug,
        sessionId: session.id,
        flowId: session.flowId,
        conversationId: session.conversationId,
        nodeId: node.id,
        type: "node_failed",
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Falha ao executar bloco.",
      })
      return getConversationFlowSession(session.id)
    }

    inboundInput = null
  }

  await setConversationFlowSessionStatus(session.id, "completed", "loop_guard")
  return getConversationFlowSession(session.id)
}

export async function startConversationFlow(input: {
  tenantSlug: string
  conversationId: string
  flowId: string
  startedBy?: string | null
}) {
  const conversation = await findInboxConversation(input.tenantSlug, input.conversationId)

  if (!conversation) {
    throw new Error("Conversa nao encontrada.")
  }

  const session = await createConversationFlowSession({
    tenantSlug: input.tenantSlug,
    conversationId: input.conversationId,
    channelInstanceId: conversation.channelInstanceId,
    externalContactId: conversation.externalContactId,
    flowId: input.flowId,
    startedBy: input.startedBy,
  })

  await updateInboxConversation(input.tenantSlug, input.conversationId, {
    handledBy: "ai",
    status: "open",
    unreadCount: 0,
  })

  await logConversationFlowEvent({
    tenantSlug: input.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    type: "session_started",
  })
  await enqueueAdvanceConversationFlow({ sessionId: session.id })
  scheduleAppJobProcessing()

  return session
}

export async function startDefaultConversationFlowIfAvailable(input: {
  tenantSlug: string
  conversationId: string
  allowOperatorConversation?: boolean
}) {
  const conversation = await findInboxConversation(input.tenantSlug, input.conversationId)

  if (!conversation) {
    return null
  }

  if (conversation.handledBy !== "ai" && !input.allowOperatorConversation) {
    return null
  }

  const existing = await findRunningConversationFlowSession(input.tenantSlug, input.conversationId)
  if (existing) {
    return existing
  }

  const settings = await getTenantSettings(input.tenantSlug)
  const defaultFlowId = settings.automation.defaultConversationFlowId

  if (!defaultFlowId) {
    return null
  }

  const flow = await findConversationFlow(input.tenantSlug, defaultFlowId)

  if (!flow || flow.status !== "published") {
    return null
  }

  return startConversationFlow({
    tenantSlug: input.tenantSlug,
    conversationId: input.conversationId,
    flowId: defaultFlowId,
  })
}

export async function consumeConversationFlowInboundMessage(input: {
  tenantSlug: string
  conversationId: string
  message: InboxMessage | null
}) {
  if (!input.message || input.message.direction !== "inbound") {
    return { consumed: false, reason: "no_inbound_message" }
  }

  const session = await findRunningConversationFlowSession(input.tenantSlug, input.conversationId)

  if (!session || session.status !== "waiting") {
    return { consumed: false, reason: "no_waiting_session" }
  }

  const version = await findConversationFlowVersion(session.tenantSlug, session.flowVersionId)

  if (!version || !canConsumeUserInput(session, version.graph)) {
    return { consumed: false, reason: "session_not_consuming_input" }
  }

  await logConversationFlowEvent({
    tenantSlug: session.tenantSlug,
    sessionId: session.id,
    flowId: session.flowId,
    conversationId: session.conversationId,
    type: "message_received",
    payload: {
      messageId: input.message.id,
      text: input.message.content,
      contentType: input.message.contentType,
      mediaUrl: input.message.mediaUrl || input.message.imageUrl,
    },
  })
  await advanceConversationFlowSession(session.id, input.message)

  return { consumed: true, sessionId: session.id }
}

export async function pauseConversationFlowSession(sessionId: string, reason = "manual_pause") {
  const session = await setConversationFlowSessionStatus(sessionId, "paused", reason)

  if (session) {
    await logConversationFlowEvent({
      tenantSlug: session.tenantSlug,
      sessionId: session.id,
      flowId: session.flowId,
      conversationId: session.conversationId,
      type: "session_paused",
      payload: { reason },
    })
  }

  return session
}

export async function resumeConversationFlowSession(sessionId: string) {
  const session = await getConversationFlowSession(sessionId)

  if (!session || session.status !== "paused") {
    return session
  }

  const resumed = await updateConversationFlowSession(session.id, {
    status: session.awaitingNodeId ? "waiting" : "active",
    pausedReason: null,
    pausedAt: null,
  })

  if (resumed) {
    await logConversationFlowEvent({
      tenantSlug: resumed.tenantSlug,
      sessionId: resumed.id,
      flowId: resumed.flowId,
      conversationId: resumed.conversationId,
      type: "session_resumed",
    })
    await enqueueAdvanceConversationFlow({ sessionId: resumed.id })
    scheduleAppJobProcessing()
  }

  return resumed
}

export async function stopConversationFlowSession(sessionId: string, reason = "manual_stop") {
  const session = await setConversationFlowSessionStatus(sessionId, "completed", reason)

  if (session) {
    await logConversationFlowEvent({
      tenantSlug: session.tenantSlug,
      sessionId: session.id,
      flowId: session.flowId,
      conversationId: session.conversationId,
      type: "session_completed",
      payload: { reason },
    })
  }

  return session
}
