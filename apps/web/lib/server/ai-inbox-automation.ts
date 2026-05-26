import { stat } from "node:fs/promises"
import path from "node:path"

import type { NextAction } from "@studio/contracts"

import type { CatalogItem } from "@/lib/catalog-types"
import type { CompositionJobReference, CompositionMode } from "@/lib/composition-types"
import type { AiClassificationResult } from "@/lib/ai-types"
import type {
  InboxCompositionSession,
  InboxCompositionSessionProduct,
  InboxConversationState,
  InboxMessage,
} from "@/lib/inbox-types"
import { findCatalogColorReferences, formatCatalogColorReferences, getPrimaryCatalogColor } from "@/lib/server/catalog-color-utils"
import { readProviders } from "@/lib/server/channel-providers-store"
import { classifyInboundMessage } from "@/lib/server/ai-orchestrator"
import { recordAiTrace } from "@/lib/server/ai-observability-store"
import { enqueueProcessCompositionQueue, scheduleAppJobProcessing } from "@/lib/server/app-job-queue"
import { hasCatalogReferenceImage } from "@/lib/server/catalog-reference-image"
import { ensureCompositionBaseSnapshot } from "@/lib/server/composition-base-snapshots"
import { createCompositionJob, listCompositionJobs } from "@/lib/server/composition-jobs-store"
import {
  appendAssistantInboxMessage,
  createEmptyInboxCompositionSession,
  findInboxConversation,
  listInboxMessages,
  normalizeInboxCompositionSession,
  updateInboxConversation,
  updateInboxConversationCompositionSession,
} from "@/lib/server/inbox-store"
import { listCatalogItems } from "@/lib/server/catalog-store"
import { getPublicAppBaseUrl } from "@/lib/server/public-url"
import { getRuntimePublicDir } from "@/lib/server/runtime-paths"
import { getTenantSettings } from "@/lib/server/tenant-settings-store"
import type { StoredTenantChannelInstance } from "@/lib/server/tenant-channel-instances-store"
import { sendUazapiText } from "@/lib/server/uazapi-client"

const STALE_CONVERSATION_MS = 15 * 60 * 1000

function getProviderMessageId(payload: unknown) {
  if (typeof payload !== "object" || !payload) {
    return undefined
  }

  const record = payload as Record<string, unknown>
  const id = record.id ?? record.messageid ?? record.messageId

  return typeof id === "string" ? id : undefined
}

function mapNextActionToState(nextAction: NextAction): InboxConversationState {
  if (nextAction === "ask_for_base_image") return "awaiting_base_image"
  if (nextAction === "ask_for_reference_image") return "collecting_preferences"
  if (nextAction === "show_catalog_options") return "showing_options"
  if (nextAction === "create_composition_job") return "composing"
  if (nextAction === "handoff_to_operator") return "idle"

  return "idle"
}

function getDefaultReply(nextAction: NextAction) {
  if (nextAction === "ask_for_base_image") {
    return "Me envie a imagem do ambiente que voce quer transformar."
  }

  if (nextAction === "ask_for_reference_image") {
    return "Recebi sua mensagem. Agora me envie ou descreva a referência que voce quer aplicar. A referência é o produto, material, cor, textura ou estilo que deve ser usado no ambiente."
  }

  if (nextAction === "show_catalog_options") {
    return "Vou separar algumas opcoes do catalogo para voce avaliar."
  }

  if (nextAction === "create_composition_job") {
    return "Tenho as informacoes principais. Vou preparar a composicao visual."
  }

  if (nextAction === "handoff_to_operator") {
    return "Vou chamar um operador para continuar seu atendimento."
  }

  return "Como posso ajudar com sua composição visual?"
}

function getMessageMediaUrl(tenantSlug: string, message: InboxMessage) {
  if (!message.mediaUrl && !message.imageUrl) {
    return undefined
  }

  return `/api/tenant/${tenantSlug}/inbox/conversations/${encodeURIComponent(message.conversationId)}/messages/${encodeURIComponent(message.id)}/media`
}

function getLatestBaseImageMessage(messages: InboxMessage[]) {
  return [...messages].reverse().find((message) =>
    message.direction === "inbound" &&
    message.contentType === "image" &&
    Boolean(message.mediaUrl || message.imageUrl)
  ) ?? null
}

function getRecentBaseImageMessages(messages: InboxMessage[], limit = 5) {
  return [...messages]
    .reverse()
    .filter((message) =>
      message.direction === "inbound" &&
      message.contentType === "image" &&
      Boolean(message.mediaUrl || message.imageUrl)
    )
    .slice(0, limit)
}

function hasOutboundReplyAfterMessage(messages: InboxMessage[], message: InboxMessage) {
  const messageTime = getMessageTime(message.createdAt)

  return messages.some((item) =>
    item.direction === "outbound" &&
    (item.role === "assistant" || item.role === "operator") &&
    getMessageTime(item.createdAt) > messageTime
  )
}

function isAlbumNotice(text: string) {
  return /^album:\s*\d+\s*(image|images|imagem|imagens)/i.test(text.trim())
}

function shouldDeferAlbumImageReply(messages: InboxMessage[], message: InboxMessage) {
  if (message.contentType !== "image" || message.content.trim() !== "Imagem recebida") {
    return false
  }

  const messageTime = getMessageTime(message.createdAt)

  return [...messages].reverse().some((item) => {
    if (item.id === message.id || item.direction !== "inbound") {
      return false
    }

    const elapsedMs = messageTime - getMessageTime(item.createdAt)

    if (elapsedMs < 0 || elapsedMs > 90_000) {
      return false
    }

    return item.contentType === "text" && isAlbumNotice(item.content)
  })
}

function isClientReferenceImageInstruction(text: string) {
  const normalized = normalizeSearchText(text)

  return includesAny(normalized, [
    "referencia",
    "referências",
    "referencias",
    "imagem de referencia",
    "foto de referencia",
    "modelo",
    "inspiracao",
    "inspiração",
    "amostra",
    "padrao",
    "padrão",
    "textura",
    "material",
    "acabamento",
    "usar como referencia",
    "use como referencia",
    "essa referencia",
    "esta referencia",
  ])
}

function hasTextualReferenceCue(text: string) {
  const normalized = normalizeSearchText(text)

  return includesAny(normalized, [
    "acabamento",
    "amadeirado",
    "azul",
    "bege",
    "branco",
    "cimento",
    "cinza",
    "concreto",
    "cor",
    "couro",
    "granito",
    "madeira",
    "marmore",
    "material",
    "modelo",
    "padrao",
    "pedra",
    "porcelanato",
    "referencia",
    "revestimento",
    "ripado",
    "textura",
    "tijolo",
    "verde",
    "vidro",
  ]) || /\b(?:com|de|em|por|igual a|parecido com|na cor)\s+[a-z0-9]/.test(normalized)
}

function getFreeTextReferenceForComposition(input: {
  text: string
  hasKnownReference: boolean
  hasDirection: boolean
}) {
  const text = input.text.trim()

  if (!text || input.hasKnownReference || !input.hasDirection || !hasTextualReferenceCue(text)) {
    return ""
  }

  return text
}

function getComoFicaTriggerMatch(text: string) {
  const normalized = normalizeSearchText(text).trim()
  const compact = normalized.replace(/[^a-z0-9]+/g, "")

  if (!compact.startsWith("comofica")) {
    return null
  }

  return {
    isOnlyTrigger: compact === "comofica",
  }
}

function isComoFicaAutoStartRequest(text: string) {
  return Boolean(getComoFicaTriggerMatch(text))
}

function isUseRecentImagesRequest(text: string) {
  const normalized = normalizeSearchText(text)

  return includesAny(normalized, [
    "essas imagens",
    "estas imagens",
    "as imagens",
    "duas imagens",
    "ambas imagens",
    "ambas as imagens",
    "quero usar essas",
    "quero usar elas",
    "usar essas imagens",
    "usar as duas",
  ])
}

type ImagePairRoleChoice = "first_base" | "second_base"

function getImagePairRoleChoice(text: string): ImagePairRoleChoice | null {
  const normalized = normalizeSearchText(text).trim()

  if (/^(1|opcao 1|opção 1|primeira|a primeira|primeira cena|primeira e cena|primeira é cena|primeiro ambiente|primeira e ambiente|primeira é ambiente)$/.test(normalized)) {
    return "first_base"
  }

  if (/^(2|opcao 2|opção 2|segunda|a segunda|segunda cena|segunda e cena|segunda é cena|segundo ambiente|segunda e ambiente|segunda é ambiente)$/.test(normalized)) {
    return "second_base"
  }

  if (
    includesAny(normalized, ["primeira imagem e a cena", "primeira foto e a cena", "primeira como cena"]) ||
    (
      includesAny(normalized, ["primeira imagem", "primeira foto"]) &&
      includesAny(normalized, ["cena", "ambiente", "base"])
    )
  ) {
    return "first_base"
  }

  if (
    includesAny(normalized, ["segunda imagem e a cena", "segunda foto e a cena", "segunda como cena"]) ||
    (
      includesAny(normalized, ["segunda imagem", "segunda foto"]) &&
      includesAny(normalized, ["cena", "ambiente", "base"])
    )
  ) {
    return "second_base"
  }

  return null
}

function isImagePairRoleQuestion(content: string) {
  const normalized = normalizeSearchText(content)

  return (normalized.includes("qual e o ambiente") || normalized.includes("qual e a cena")) &&
    normalized.includes("qual e a referencia")
}

function getPendingImagePairRoleRequest(messages: InboxMessage[], currentMessageId: string, currentContent = "") {
  const previousMessages = messages.filter((message) => message.id !== currentMessageId)
  let questionIndex = -1

  for (let index = previousMessages.length - 1; index >= 0; index -= 1) {
    const message = previousMessages[index]

    if (
      message.direction === "outbound" &&
      message.role === "assistant" &&
      isImagePairRoleQuestion(message.content)
    ) {
      questionIndex = index
      break
    }
  }

  if (questionIndex === -1) {
    return null
  }

  if (currentContent && !getImagePairRoleChoice(currentContent)) {
    return null
  }

  const assistantRepliesAfterQuestion = previousMessages
    .slice(questionIndex + 1)
    .filter((message) => message.direction === "outbound" && message.role === "assistant")

  if (assistantRepliesAfterQuestion.length > 0) {
    return null
  }

  return previousMessages[questionIndex].content
}

function formatImagePairRoleQuestion() {
  return [
    "Recebi duas imagens. Qual é o ambiente e qual é a referência?",
    "O ambiente é a foto real que será preservada como base. A referência é o produto, material, cor, textura ou estilo que deve ser aplicado.",
    "Responda 1 se a primeira imagem for o ambiente e a segunda for a referência.",
    "Responda 2 se a primeira imagem for a referência e a segunda for o ambiente.",
  ].join("\n\n")
}

function toSessionProduct(item: CatalogItem, color?: string): InboxCompositionSessionProduct {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    color,
  }
}

function findSessionProductItem(session: InboxCompositionSession, items: CatalogItem[]) {
  const product = session.selectedProducts[0]

  if (!product) {
    return null
  }

  return items.find((item) =>
    (product.id && item.id === product.id) ||
    (product.sku && normalizeSkuSearchText(item.sku || "") === normalizeSkuSearchText(product.sku))
  ) ?? null
}

function upsertSessionProduct(session: InboxCompositionSession, product: InboxCompositionSessionProduct) {
  return [
    product,
    ...session.selectedProducts.filter((item) =>
      item.id !== product.id &&
      normalizeSkuSearchText(item.sku || "") !== normalizeSkuSearchText(product.sku || "") &&
      normalizeSearchText(item.name) !== normalizeSearchText(product.name)
    ),
  ].slice(0, 5)
}

function hasWorkingResult(session: InboxCompositionSession) {
  return Boolean(session.workingImage?.imageUrl || session.workingImage?.jobId)
}

function shouldUseLatestResultByDefault(text: string, session: InboxCompositionSession) {
  const normalized = normalizeSearchText(text)

  if (!hasWorkingResult(session)) {
    return false
  }

  if (getExplicitCompositionBaseChoice(text) || wantsDifferentBaseImage(text)) {
    return false
  }

  return session.step === "completed" ||
    includesAny(normalized, [
      "agora",
      "tambem",
      "também",
      "depois",
      "continuar",
      "continua",
      "nessa",
      "nesta",
      "na imagem",
      "na composicao",
      "na composição",
      "coloca",
      "colocar",
      "troca",
      "trocar",
      "muda",
      "mudar",
      "aplica",
      "aplicar",
      "adiciona",
      "adicionar",
      "remove",
      "remover",
    ])
}

type CompositionBaseChoice = "original" | "result"
type PreviousCompositionChoice = CompositionBaseChoice | "new"

type CompositionBase = {
  message?: InboxMessage
  imageUrl?: string
  label: string
  choice: CompositionBaseChoice
}

function getLatestCompletedCompositionJob(jobs: Awaited<ReturnType<typeof listCompositionJobs>>, conversationId: string) {
  return jobs.find((job) =>
    job.conversationId === conversationId &&
    job.status === "done" &&
    Boolean(job.resultImageUrl)
  ) ?? null
}

function getRecentCompletedCompositionJobs(
  jobs: Awaited<ReturnType<typeof listCompositionJobs>>,
  conversationId: string,
  limit = 5,
) {
  return jobs
    .filter((job) =>
      job.conversationId === conversationId &&
      job.status === "done" &&
      Boolean(job.resultImageUrl)
    )
    .slice(0, limit)
}

function findCompositionResultMessage(messages: InboxMessage[], job: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>) {
  if (!job?.resultImageUrl) {
    return null
  }

  const jobShortId = job.id.slice(0, 8)

  return [...messages].reverse().find((message) =>
    message.direction === "outbound" &&
    message.role === "assistant" &&
    message.contentType === "image" &&
    (
      message.mediaFileName === `composicao-${jobShortId}.png` ||
      message.content.includes(`ID do processo: ${jobShortId}`) ||
      message.content.includes(`ID do job: ${jobShortId}`) ||
      message.mediaUrl === job.resultImageUrl ||
      message.imageUrl === job.resultImageUrl
    )
  ) ?? null
}

function getExplicitCompositionBaseChoice(text: string): CompositionBaseChoice | null {
  const normalized = normalizeSearchText(text)

  if (includesAny(normalized, [
    "imagem original",
    "foto original",
    "original",
    "primeira imagem",
    "primeira foto",
    "foto que mandei",
    "imagem que mandei",
    "imagem enviada",
  ])) {
    return "original"
  }

  if (includesAny(normalized, [
    "usar a composicao",
    "usar essa composicao",
    "usar esta composicao",
    "composicao gerada",
    "composicao pronta",
    "resultado",
    "imagem gerada",
    "gerada",
    "ultima composicao",
    "composicao pronta",
    "imagem pronta",
  ])) {
    return "result"
  }

  return null
}

function inferCompositionBaseChoice(input: {
  text: string
  session: InboxCompositionSession
  latestBaseImageMessage: InboxMessage | null
  latestCompletedJob: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>
}) {
  const explicitChoice = getExplicitCompositionBaseChoice(input.text)

  if (explicitChoice) {
    return explicitChoice
  }

  if (input.session.preferredBase) {
    return input.session.preferredBase
  }

  if (!input.latestCompletedJob?.resultImageUrl) {
    return "original"
  }

  const latestBaseImageTime = input.latestBaseImageMessage
    ? getMessageTime(input.latestBaseImageMessage.createdAt)
    : 0
  const latestResultTime = getMessageTime(input.latestCompletedJob.completedAt ?? input.latestCompletedJob.createdAt)
  const sessionBaseImageTime = input.session.baseImage?.createdAt
    ? getMessageTime(input.session.baseImage.createdAt)
    : 0
  const sessionWorkingImageTime = input.session.workingImage?.createdAt
    ? getMessageTime(input.session.workingImage.createdAt)
    : 0

  if (
    latestBaseImageTime > latestResultTime ||
    sessionBaseImageTime > sessionWorkingImageTime
  ) {
    return "original"
  }

  if (shouldUseLatestResultByDefault(input.text, input.session)) {
    return "result"
  }

  // Conversa natural: sem instrucao contraria, continua sobre o artefato mais recente.
  return hasWorkingResult(input.session) ? "result" : "original"
}

function getCompositionBaseChoiceAnswer(text: string): CompositionBaseChoice | null {
  const normalized = normalizeSearchText(text).trim()

  if (/^(1|opcao 1|opção 1|original|a original|imagem original|foto original|primeira|a primeira)$/.test(normalized)) {
    return "original"
  }

  if (/^(2|opcao 2|opção 2|nova|a nova|imagem nova|resultado|a gerada|gerada|ultima|a ultima)$/.test(normalized)) {
    return "result"
  }

  return getExplicitCompositionBaseChoice(text)
}

function isBaseChoiceOnlyAnswer(text: string) {
  const normalized = normalizeSearchText(text).trim()

  return /^(1|opcao 1|opção 1|original|a original|imagem original|foto original|primeira|a primeira|2|opcao 2|opção 2|nova|a nova|imagem nova|resultado|a gerada|gerada|ultima|a ultima)$/.test(normalized)
}

function isVagueCompositionRequest(text: string | null | undefined) {
  const normalized = normalizeSearchText(text || "").trim()

  if (!normalized || normalized === "imagem recebida" || isBaseChoiceOnlyAnswer(normalized)) {
    return false
  }

  const hasVagueRequest = (
    /^(quero\s+)?(?:simular|fazer|gerar|criar|renderizar)\s+(?:outra|nova|novo)(?:\s+(?:imagem|foto|composicao|composição|simulacao|simulação))?$/.test(normalized) ||
    /^(?:outra|nova)\s+(?:imagem|foto|composicao|composição|simulacao|simulação)$/.test(normalized) ||
    /^(?:simular|fazer|gerar|criar|renderizar)\s+(?:de novo|novamente|mais uma)$/.test(normalized) ||
    /^(?:de novo|novamente|mais uma)$/.test(normalized) ||
    includesAny(normalized, [
      "simular outra imagem",
      "simular outra foto",
      "simular de novo",
      "fazer outra imagem",
      "fazer outra foto",
      "fazer outra composicao",
      "fazer outra composição",
      "gerar outra imagem",
      "gerar outra foto",
      "criar outra imagem",
      "criar outra foto",
      "nova simulacao",
      "nova simulação",
      "nova composicao",
      "nova composição",
      "mais uma simulacao",
      "mais uma simulação",
    ])
  )

  if (!hasVagueRequest) {
    return false
  }

  return !includesAny(normalized, [
    "bancada",
    "cadeira",
    "chao",
    "chão",
    "cor",
    "janela",
    "madeira",
    "mesa",
    "movel",
    "móvel",
    "parede",
    "pintura",
    "piso",
    "porta",
    "porcelanato",
    "produto",
    "revestimento",
    "sofa",
    "sofá",
    "teto",
    "textura",
    "tinta",
  ])
}

function wantsDifferentBaseImage(text: string) {
  const normalized = normalizeSearchText(text)

  return includesAny(normalized, [
    "outra imagem",
    "outra foto",
    "nova foto",
    "nova imagem base",
    "imagem diferente",
    "foto diferente",
    "usar outra",
    "usar uma outra",
    "enviar outra",
    "mandar outra",
  ])
}

function isBaseChoiceQuestion(content: string) {
  const normalized = normalizeSearchText(content)

  return normalized.includes("original") &&
    normalized.includes("nova") &&
    normalized.includes("base")
}

function getPreviousCompositionChoiceAnswer(text: string): PreviousCompositionChoice | null {
  const normalized = normalizeSearchText(text).trim()

  if (/^(1|opcao 1|opção 1|gerada|a gerada|imagem gerada|resultado|ultimo resultado|último resultado|ultima|última|usar gerada|usar a gerada)$/.test(normalized)) {
    return "result"
  }

  if (/^(2|opcao 2|opção 2|original|a original|imagem original|foto original|usar original|usar a original)$/.test(normalized)) {
    return "original"
  }

  if (/^(3|opcao 3|opção 3|novo|nova|novo processo|nova composicao|nova composição|comecar novo|começar novo|comecar de novo|começar de novo)$/.test(normalized)) {
    return "new"
  }

  return null
}

function isPreviousCompositionChoiceQuestion(content: string) {
  const normalized = normalizeSearchText(content)

  return normalized.includes("encontrei uma composicao anterior") &&
    normalized.includes("usar a imagem gerada") &&
    normalized.includes("usar a imagem original") &&
    normalized.includes("comecar um novo processo")
}

function getPendingPreviousCompositionChoiceRequest(messages: InboxMessage[], currentMessageId: string, currentContent = "") {
  const previousMessages = messages.filter((message) => message.id !== currentMessageId)
  let questionIndex = -1

  for (let index = previousMessages.length - 1; index >= 0; index -= 1) {
    const message = previousMessages[index]

    if (
      message.direction === "outbound" &&
      message.role === "assistant" &&
      isPreviousCompositionChoiceQuestion(message.content)
    ) {
      questionIndex = index
      break
    }
  }

  if (questionIndex === -1) {
    return null
  }

  if (currentContent && !getPreviousCompositionChoiceAnswer(currentContent)) {
    return null
  }

  const assistantRepliesAfterQuestion = previousMessages
    .slice(questionIndex + 1)
    .filter((message) => message.direction === "outbound" && message.role === "assistant")

  if (assistantRepliesAfterQuestion.length > 0) {
    return null
  }

  return previousMessages[questionIndex].content
}

function formatPreviousCompositionChoiceQuestion() {
  return [
    "Encontrei uma composição anterior. Você quer continuar com ela ou começar uma nova?",
    "1. Usar a imagem gerada como base",
    "2. Usar a imagem original como base",
    "3. Começar um novo processo",
  ].join("\n")
}

function formatSelectedBaseDirectionQuestion(choice: CompositionBaseChoice) {
  return choice === "result"
    ? "Perfeito. Vou usar a última composição como base. O que você quer alterar nela?"
    : "Perfeito. Vou usar a imagem original como base. O que você quer simular nela?"
}

function getPendingBaseChoiceRequest(messages: InboxMessage[], currentMessageId: string, currentContent = "") {
  const previousMessages = messages.filter((message) => message.id !== currentMessageId)
  let questionIndex = -1

  for (let index = previousMessages.length - 1; index >= 0; index -= 1) {
    const message = previousMessages[index]

    if (
      message.direction === "outbound" &&
      message.role === "assistant" &&
      isBaseChoiceQuestion(message.content)
    ) {
      questionIndex = index
      break
    }
  }

  if (questionIndex === -1) {
    return null
  }

  if (currentContent && !isBaseChoiceOnlyAnswer(currentContent)) {
    return null
  }

  const inboundMessagesAfterQuestion = previousMessages
    .slice(questionIndex + 1)
    .filter((message) => message.direction === "inbound")

  if (inboundMessagesAfterQuestion.length > 0) {
    return null
  }

  for (let index = questionIndex - 1; index >= 0; index -= 1) {
    const message = previousMessages[index]

    if (message.direction === "inbound" && message.contentType === "text" && message.content.trim()) {
      if (isBaseChoiceOnlyAnswer(message.content)) {
        continue
      }

      return message.content.trim()
    }
  }

  return null
}

function getGeneratedPublicFilePath(imageUrl?: string) {
  if (!imageUrl) {
    return null
  }

  try {
    const url = /^https?:\/\//i.test(imageUrl) ? new URL(imageUrl) : null
    const pathname = url ? url.pathname : imageUrl

    if (!pathname.startsWith("/generated/")) {
      return null
    }

    return path.join(getRuntimePublicDir(), pathname.replace(/^\/+/, ""))
  } catch {
    return null
  }
}

async function isCompositionBaseAvailable(base: CompositionBase) {
  const generatedPath = getGeneratedPublicFilePath(base.imageUrl)

  if (!generatedPath) {
    return true
  }

  try {
    await stat(generatedPath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false
    }

    throw error
  }
}

function getCompletedJobCompositionBase(input: {
  latestResultMessage: InboxMessage | null
  latestCompletedJob: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>
  tenantSlug: string
}): CompositionBase | null {
  if (!input.latestCompletedJob?.resultImageUrl) {
    return null
  }

  return {
    message: input.latestResultMessage ?? undefined,
    imageUrl: input.latestResultMessage
      ? getMessageMediaUrl(input.tenantSlug, input.latestResultMessage)
      : input.latestCompletedJob.resultImageUrl,
    label: "imagem gerada",
    choice: "result",
  } satisfies CompositionBase
}

function getOriginalCompositionBase(input: {
  latestBaseImageMessage: InboxMessage | null
  latestCompletedJob: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>
  tenantSlug: string
}): CompositionBase | null {
  if (input.latestBaseImageMessage) {
    return {
      message: input.latestBaseImageMessage,
      imageUrl: getMessageMediaUrl(input.tenantSlug, input.latestBaseImageMessage),
      label: "imagem original",
      choice: "original",
    } satisfies CompositionBase
  }

  if (input.latestCompletedJob?.baseImageUrl) {
    return {
      imageUrl: input.latestCompletedJob.baseImageUrl,
      label: "imagem original",
      choice: "original",
    } satisfies CompositionBase
  }

  return null
}

function getSessionCompositionBase(session: InboxCompositionSession): CompositionBase | null {
  if (!session.baseImage?.imageUrl) {
    return null
  }

  return {
    imageUrl: session.baseImage.imageUrl,
    label: session.baseImage.label || (session.baseImage.kind === "result" ? "imagem gerada" : "imagem original"),
    choice: session.baseImage.kind === "result" ? "result" : "original",
  } satisfies CompositionBase
}

async function resolveCompositionBase(input: {
  choice: CompositionBaseChoice | null
  latestBaseImageMessage: InboxMessage | null
  latestResultMessage: InboxMessage | null
  latestCompletedJob: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>
  session: InboxCompositionSession
  tenantSlug: string
}) {
  const resultBase = getCompletedJobCompositionBase(input)
  const originalBase = getOriginalCompositionBase(input)

  if (input.choice === "result" && resultBase && await isCompositionBaseAvailable(resultBase)) {
    return resultBase
  }

  if (input.choice === "original" && originalBase) {
    return originalBase
  }

  if (originalBase) {
    return originalBase
  }

  const sessionBase = getSessionCompositionBase(input.session)

  if (sessionBase) {
    return sessionBase
  }

  if (resultBase && await isCompositionBaseAvailable(resultBase)) {
    return resultBase
  }

  return null
}

function formatMessageForAiContext(message: InboxMessage, latestBaseImageId?: string) {
  const content = message.content?.trim()

  if (message.contentType === "image") {
    const baseMarker = message.id === latestBaseImageId ? "Imagem base mais recente do cliente." : "Imagem enviada na conversa."
    const text = content && content !== "Imagem recebida" ? ` Legenda/texto: ${content}` : ""

    return `[imagem] ${baseMarker}${text}`
  }

  if (message.contentType === "audio") {
    return `[audio] ${content || "Audio recebido na conversa."}`
  }

  if (message.contentType === "video") {
    return `[video] ${content || "Video recebido na conversa."}`
  }

  if (message.contentType === "file") {
    return `[arquivo] ${content || "Arquivo recebido na conversa."}`
  }

  return content || `[${message.contentType}]`
}

function buildArtifactContext(input: {
  session: InboxCompositionSession
  latestBaseImageMessage: InboxMessage | null
  recentBaseImageMessages: InboxMessage[]
  latestCompletedJob: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>
  recentCompletedJobs: Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>[]
  latestResultMessage: InboxMessage | null
  productReference: CatalogItem | null
  catalogReferences: CatalogItem[]
}) {
  const lines: string[] = []
  const imageMessages = uniqueInboxMessages([
    ...(input.latestBaseImageMessage ? [input.latestBaseImageMessage] : []),
    ...input.recentBaseImageMessages,
  ])
  const completedJobs = uniqueCompositionJobs([
    ...(input.latestCompletedJob ? [input.latestCompletedJob] : []),
    ...input.recentCompletedJobs,
  ])
  const catalogReferences = uniqueCatalogItems([
    ...(input.productReference ? [input.productReference] : []),
    ...input.catalogReferences,
  ])

  imageMessages.forEach((message, index) => {
    const label = index === 0 ? "imagem mais recente enviada pelo cliente" : `imagem anterior ${index + 1}`
    lines.push(`Imagem disponível (${label}): mensagem ${message.id}, recebida em ${message.createdAt}.`)
  })

  completedJobs.forEach((job, index) => {
    if (!job) return

    const label = index === 0 ? "última composição finalizada" : `composição anterior ${index + 1}`
    lines.push(`Composição gerada disponível (${label}): processo ${job.id.slice(0, 8)}.`)
  })

  if (input.latestBaseImageMessage) {
    lines.push(`Quando o cliente citar "foto que enviei", "imagem original" ou "imagem que mandei", use a mensagem ${input.latestBaseImageMessage.id}.`)
  }

  if (input.session.referenceImage?.messageId || input.session.referenceImage?.imageUrl) {
    lines.push(`Referência visual do cliente salva: ${input.session.referenceImage.label || "imagem de referência"}${input.session.referenceImage.messageId ? `, mensagem ${input.session.referenceImage.messageId}` : ""}.`)
  }

  if (input.latestCompletedJob?.resultImageUrl) {
    lines.push(`Quando o cliente citar "composição", "resultado", "imagem gerada" ou "imagem pronta", use o processo ${input.latestCompletedJob.id.slice(0, 8)}.`)
  }

  if (input.latestResultMessage) {
    lines.push(`Mensagem com a composição gerada: ${input.latestResultMessage.id}.`)
  }

  catalogReferences.slice(0, 5).forEach((item, index) => {
    const label = index === 0 && input.productReference?.id === item.id ? "Produto/SKU identificado agora" : "Produto disponível na memória"
    lines.push(`${label}: ${item.name}${item.sku ? ` (${item.sku})` : ""}${item.category ? `, categoria ${item.category}` : ""}.`)
  })

  for (const product of input.session.selectedProducts.slice(0, 3)) {
    lines.push(`Produto salvo na memória: ${product.name}${product.sku ? ` (${product.sku})` : ""}${product.color ? ` cor ${product.color}` : ""}.`)
  }

  for (const change of input.session.changes.slice(0, 5)) {
    lines.push(`Composição anterior: ${change.prompt}${change.jobId ? ` processo ${change.jobId.slice(0, 8)}` : ""}, base ${change.base}, status ${change.status}.`)
  }

  if (input.session.pendingPrompt) {
    lines.push(`Pedido pendente salvo apenas como memória, não como etapa obrigatória: ${input.session.pendingPrompt}.`)
  }

  return [...new Set(lines)].join("\n")
}

function getCompositionPrompt(message: InboxMessage, messages: InboxMessage[]) {
  if (message.content && message.content !== "Imagem recebida") {
    return message.content
  }

  return [...messages]
    .reverse()
    .find((item) => item.direction === "inbound" && item.contentType === "text" && item.content.trim())
    ?.content ?? "Composicao visual solicitada pelo cliente."
}

function buildCompositionPrompt(message: InboxMessage, messages: InboxMessage[], reference = "") {
  const prompt = getCompositionPrompt(message, messages)

  if (!reference) {
    return prompt
  }

  return `${prompt}\nReferencia visual: ${reference}`
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function normalizeSkuSearchText(value: string) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "")
}

function normalizeCategoryText(value: string) {
  return normalizeSearchText(value).trim()
}

function uniqueWords(value: string) {
  return [...new Set(
    normalizeSearchText(value)
      .split(/[^a-z0-9]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3)
  )]
}

function normalizeKeywordValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function hasConfiguredHandoffKeyword(text: string, keywords: string[]) {
  const normalizedText = normalizeKeywordValue(text)

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeKeywordValue(keyword).trim()
    return normalizedKeyword.length >= 2 && normalizedText.includes(normalizedKeyword)
  })
}

function findCatalogSkuReference(items: CatalogItem[], text: string) {
  const normalizedText = normalizeSearchText(text)
  const compactText = normalizeSkuSearchText(text)

  return items.find((item) => {
    const normalizedSku = normalizeSearchText(item.sku || "").trim()
    const compactSku = normalizeSkuSearchText(item.sku || "")

    if (!normalizedSku || !compactSku) {
      return false
    }

    return normalizedText.includes(normalizedSku) || compactText.includes(compactSku)
  }) ?? null
}

function findCatalogProductReferences(items: CatalogItem[], text: string, limit = 5) {
  const normalizedText = normalizeSearchText(text)
  const compactText = normalizeSkuSearchText(text)
  const genericNameWords = new Set([
    "aplicar",
    "colocar",
    "cor",
    "cores",
    "mudar",
    "parede",
    "piso",
    "produto",
    "produtos",
    "revestimento",
    "teto",
    "tinta",
    "trocar",
    "usar",
  ])

  return items
    .filter((item) => item.status === "active")
    .map((item) => {
      const normalizedName = normalizeSearchText(item.name)
      const normalizedSku = normalizeSearchText(item.sku || "")
      const compactSku = normalizeSkuSearchText(item.sku || "")
      const nameWords = uniqueWords(item.name)
      const matchedNameWords = nameWords.filter((word) => normalizedText.includes(word))
      const distinctiveNameWords = matchedNameWords.filter((word) => !genericNameWords.has(word))
      const score =
        (normalizedName && normalizedText.includes(normalizedName) ? 100 : 0) +
        (normalizedSku && normalizedText.includes(normalizedSku) ? 80 : 0) +
        (compactSku && compactText.includes(compactSku) ? 90 : 0) +
        (matchedNameWords.length >= 2 ? matchedNameWords.length * 12 : 0) +
        (distinctiveNameWords.length >= 1 ? distinctiveNameWords.length * 18 : 0)

      return { item, score }
    })
    .filter((reference) => reference.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((reference) => reference.item)
}

function uniqueCatalogItems(items: CatalogItem[]) {
  const seen = new Set<string>()
  const uniqueItems: CatalogItem[] = []

  for (const item of items) {
    if (seen.has(item.id)) continue

    seen.add(item.id)
    uniqueItems.push(item)
  }

  return uniqueItems
}

function uniqueInboxMessages(messages: Array<InboxMessage | null | undefined>) {
  const seen = new Set<string>()
  const uniqueMessages: InboxMessage[] = []

  for (const message of messages) {
    if (!message || seen.has(message.id)) continue

    seen.add(message.id)
    uniqueMessages.push(message)
  }

  return uniqueMessages
}

function uniqueCompositionJobs(
  jobs: Array<Awaited<ReturnType<typeof getLatestCompletedCompositionJob>> | null | undefined>,
) {
  const seen = new Set<string>()
  const uniqueJobs: NonNullable<Awaited<ReturnType<typeof getLatestCompletedCompositionJob>>>[] = []

  for (const job of jobs) {
    if (!job || seen.has(job.id)) continue

    seen.add(job.id)
    uniqueJobs.push(job)
  }

  return uniqueJobs
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function isCatalogBrowseRequest(text: string) {
  const normalized = normalizeSearchText(text)
  const compact = normalized.trim()

  if (!compact) {
    return false
  }

  if (includesAny(normalized, [
    "catalogo",
    "produtos",
    "opcoes",
    "opcao",
  ])) {
    return true
  }

  if (/^(produto|produtos|cor|cores|tinta|tintas|revestimento|revestimentos|pisos?|moveis?|sofas?|roupas?)$/.test(compact)) {
    return true
  }

  const hasDisplayIntent = includesAny(normalized, [
    "mostra",
    "mostrar",
    "ver",
    "envia",
    "enviar",
    "manda",
    "mandar",
    "quais",
    "tem",
  ])
  const hasCatalogSubject = includesAny(normalized, [
    "produto",
    "produtos",
    "cor",
    "cores",
    "tinta",
    "tintas",
    "revestimento",
    "revestimentos",
    "porcelanato",
    "piso",
    "pisos",
    "movel",
    "moveis",
    "sofa",
    "sofas",
    "roupa",
    "roupas",
    "vestido",
    "vestidos",
    "prateleira",
    "prateleiras",
  ])

  return hasDisplayIntent && hasCatalogSubject
}

function isCatalogRepeatRequest(text: string) {
  const normalized = normalizeSearchText(text)

  return includesAny(normalized, ["outra vez", "de novo", "novamente", "reenviar", "reenvia", "manda outra", "envia outra"])
}

function isCatalogMoreRequest(text: string) {
  const normalized = normalizeSearchText(text)
  const compact = normalized.trim()

  return compact === "mais" || includesAny(normalized, [
    "tem outros",
    "tem outras",
    "outras opcoes",
    "outros produtos",
    "mais opcoes",
    "mais produtos",
    "mais referencias",
    "quero mais",
  ])
}

function findCatalogItemsMentionedInText(items: CatalogItem[], text: string) {
  const normalizedText = normalizeSearchText(text)

  return items.filter((item) => {
    const normalizedName = normalizeSearchText(item.name)
    const normalizedSku = normalizeSearchText(item.sku || "")

    return Boolean(normalizedName && normalizedText.includes(normalizedName)) ||
      Boolean(normalizedSku && normalizedText.includes(normalizedSku))
  })
}

function findRecentCatalogItems(items: CatalogItem[], messages: InboxMessage[], limit = 5) {
  const references: CatalogItem[] = []

  for (const message of [...messages].reverse()) {
    if (message.direction !== "outbound") continue
    if (!message.content?.trim()) continue

    references.push(...findCatalogItemsMentionedInText(items, message.content))

    if (uniqueCatalogItems(references).length >= limit) {
      break
    }
  }

  return uniqueCatalogItems(references).slice(0, limit)
}

function pickDiverseCatalogItems(items: CatalogItem[], limit = 5) {
  const buckets = new Map<string, CatalogItem[]>()

  for (const item of items) {
    const key = normalizeCategoryText(item.category) || normalizeCategoryText(item.tags.usage_mode || "") || "catalog"
    const bucket = buckets.get(key) ?? []
    bucket.push(item)
    buckets.set(key, bucket)
  }

  const selected: CatalogItem[] = []
  const bucketList = [...buckets.values()]

  while (selected.length < limit && bucketList.some((bucket) => bucket.length > 0)) {
    for (const bucket of bucketList) {
      const item = bucket.shift()
      if (!item) continue

      selected.push(item)
      if (selected.length >= limit) break
    }
  }

  return selected
}

function getCatalogItemsForGenericRequest(items: CatalogItem[], messages: InboxMessage[], text: string, limit = 5) {
  const activeItems = items.filter((item) => item.status === "active" && hasCatalogReferenceImage(item))

  if (activeItems.length === 0) {
    return []
  }

  const recentItems = findRecentCatalogItems(activeItems, messages, limit)

  if (isCatalogRepeatRequest(text) && recentItems.length > 0) {
    return recentItems
  }

  if (isCatalogMoreRequest(text) && recentItems.length > 0) {
    const recentIds = new Set(recentItems.map((item) => item.id))
    const nextItems = pickDiverseCatalogItems(activeItems.filter((item) => !recentIds.has(item.id)), limit)

    return nextItems.length > 0 ? nextItems : recentItems
  }

  if (isCatalogBrowseRequest(text)) {
    return pickDiverseCatalogItems(activeItems, limit)
  }

  return []
}

function filterCatalogItemsForAssistant(items: CatalogItem[], categories: string[]) {
  const allowedCategories = new Set(categories.map(normalizeCategoryText).filter(Boolean))

  if (allowedCategories.size === 0) {
    return items
  }

  return items.filter((item) => {
    const category = normalizeCategoryText(item.category)
    const usageMode = normalizeCategoryText(item.tags.usage_mode || "")

    return allowedCategories.has(category) || allowedCategories.has(usageMode)
  })
}

function getDefaultWelcomeMessage(companyName: string, assistantName: string, catalogEnabled = true) {
  const company = companyName.trim() || "nossa loja"
  const name = assistantName.trim() || "assistente virtual"

  if (!catalogEnabled) {
    return `Oi, seja bem-vindo à ${company}! Eu sou ${name} e estou aqui para ajudar. Posso criar uma simulação visual a partir da foto do seu ambiente e de uma referência enviada por você aqui no WhatsApp.`
  }

  return `Oi, seja bem-vindo à ${company}! Eu sou ${name} e estou aqui para ajudar. Posso te mostrar produtos do catálogo ou criar uma simulação visual a partir da foto do seu ambiente.`
}

function getWelcomeMessage(settings: Awaited<ReturnType<typeof getTenantSettings>>) {
  return settings.assistant.welcomeMessage.trim() ||
    getDefaultWelcomeMessage(
      settings.general.companyName,
      settings.assistant.assistantName,
      settings.assistant.catalogEnabled,
    )
}

function isFirstInboundMessage(messages: InboxMessage[], currentMessageId: string) {
  return !messages.some((message) =>
    message.id !== currentMessageId &&
    message.direction === "inbound"
  )
}

function withWelcomeMessage(reply: string, welcomeMessage: string, shouldIncludeWelcome: boolean) {
  if (!shouldIncludeWelcome) {
    return reply
  }

  if (!reply.trim() || normalizeSearchText(reply).includes(normalizeSearchText(welcomeMessage).slice(0, 40))) {
    return welcomeMessage
  }

  return `${welcomeMessage}\n\n${reply}`
}

function getAssistantSystemPrompt(settings: Awaited<ReturnType<typeof getTenantSettings>>) {
  return [
    `Nome do assistente: ${settings.assistant.assistantName || "Yá"}.`,
    settings.assistant.catalogEnabled
      ? settings.assistant.catalogCategories.length > 0
        ? `Categorias permitidas para consulta no WhatsApp: ${settings.assistant.catalogCategories.join(", ")}. Nao ofereca produtos fora dessas categorias.`
        : "Categorias permitidas para consulta no WhatsApp: todas as categorias ativas do catalogo."
      : "Catalogo desabilitado neste tenant. Nao ofereca catalogo, nao envie link do catalogo, nao peca SKU/produto do catalogo e use apenas referencias enviadas pelo cliente no WhatsApp ou descritas em texto.",
    settings.assistant.systemPrompt.trim(),
  ].filter(Boolean).join("\n")
}

function getPublicCatalogUrl(tenantSlug: string) {
  return `${getPublicAppBaseUrl()}/catalogo/${encodeURIComponent(tenantSlug)}`
}

function formatCatalogLinkReply(tenantSlug: string) {
  return [
    `Aqui está o link dos nossos produtos: ${getPublicCatalogUrl(tenantSlug)}`,
    "Pode dar uma olhada e me dizer qual produto você quer usar na composição.",
  ].join("\n\n")
}

function formatCompositionMissingInputsReply(input: {
  hasBaseImage: boolean
  hasVisualReference: boolean
  hasDirection: boolean
  tenantSlug?: string
  catalogEnabled?: boolean
}) {
  if (!input.hasBaseImage) {
    if (input.hasVisualReference) {
      return "Já tenho a referência. Agora me envie a imagem do ambiente em que você quer aplicar essa referência e me diga como ela deve ser aplicada."
    }

    return "Para criar a composição, primeiro me envie a imagem do ambiente que você quer transformar."
  }

  if (!input.hasVisualReference && !input.hasDirection) {
    return [
      "Recebi a imagem do ambiente. Agora preciso saber qual é a referência que você quer usar e como ela deve ser aplicada.",
      "A referência é o produto, material, cor, textura ou estilo que deve entrar no ambiente.",
      input.catalogEnabled && input.tenantSlug
        ? `Se quiser escolher no catálogo, aqui está o link: ${getPublicCatalogUrl(input.tenantSlug)}`
        : "Você pode me mandar uma imagem de referência ou descrever a referência que quer aplicar.",
    ].join("\n\n")
  }

  if (!input.hasVisualReference) {
    return [
      "Entendi o que você quer fazer na imagem. Agora preciso da referência visual.",
      "A referência é o produto, material, cor, textura ou estilo que deve ser aplicado no ambiente.",
      input.catalogEnabled && input.tenantSlug
        ? `Se quiser escolher no catálogo, aqui está o link: ${getPublicCatalogUrl(input.tenantSlug)}`
        : "Você pode me mandar uma imagem de referência ou descrever a referência que quer aplicar.",
    ].join("\n\n")
  }

  return "Perfeito, já tenho a referência. Agora me diga exatamente o que você quer fazer no ambiente e onde aplicar essa referência."
}

function isColorEditRequest(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

  return (
    normalized.includes("cor") ||
    normalized.includes("tinta") ||
    normalized.includes("pint") ||
    normalized.includes("parede")
  ) && (
    normalized.includes("trocar") ||
    normalized.includes("mudar") ||
    normalized.includes("alterar") ||
    normalized.includes("colocar") ||
    normalized.includes("usar")
  )
}

function isLikelyExternalAutoReply(text: string) {
  const normalized = normalizeSearchText(text)

  return [
    "no momento nao consegui te responder",
    "em breve retorno sua mensagem",
    "mensagem automatica",
    "resposta automatica",
    "fora do horario de atendimento",
    "atendimento com hora marcada",
  ].some((term) => normalized.includes(term))
}

function getMessageTime(value: string) {
  const time = new Date(value).getTime()

  return Number.isFinite(time) ? time : 0
}

function getPreviousConversationMessage(messages: InboxMessage[], currentMessageId: string) {
  return [...messages]
    .filter((message) => message.id !== currentMessageId)
    .sort((left, right) => getMessageTime(right.createdAt) - getMessageTime(left.createdAt))[0] ?? null
}

function hasOpenStructuredTask(
  conversationState: InboxConversationState,
  session: InboxCompositionSession,
  pendingBaseChoiceRequest: string | null,
  pendingSessionPrompt?: string,
) {
  return Boolean(
    pendingBaseChoiceRequest ||
    pendingSessionPrompt ||
    ["awaiting_base_image", "collecting_preferences", "showing_options", "awaiting_selection"].includes(conversationState) ||
    ["product_selected", "awaiting_reference_image", "awaiting_base_image"].includes(session.step)
  )
}

function isActionableVisualInstruction(text: string) {
  const normalized = normalizeSearchText(text)
  const hasAction = hasVisualCompositionAction(normalized)
  const hasTarget = includesAny(normalized, [
    "ambiente",
    "cadeira",
    "chao",
    "composicao",
    "composição",
    "foto",
    "imagem",
    "mesa",
    "movel",
    "moveis",
    "móvel",
    "móveis",
    "objeto",
    "parede",
    "piso",
    "porta",
    "produto",
    "revestimento",
    "sofa",
    "sofá",
    "teto",
    "janela",
  ])

  return hasAction && hasTarget
}

function hasVisualCompositionAction(normalizedText: string) {
  return includesAny(normalizedText, [
    "adicionar",
    "adiciona",
    "adicione",
    "apagar",
    "aplica",
    "aplique",
    "aplicar",
    "alterar",
    "coloca",
    "coloque",
    "colocar",
    "criar",
    "deixar",
    "edita",
    "editar",
    "gerar",
    "inclui",
    "inclua",
    "incluir",
    "insere",
    "insira",
    "inserir",
    "instala",
    "instale",
    "instalar",
    "mude",
    "mudar",
    "pintar",
    "revestir",
    "remover",
    "render",
    "simular",
    "substitua",
    "substituir",
    "tirar",
    "complementa",
    "complemente",
    "complementar",
    "transformar",
    "troque",
    "trocar",
    "usar",
    "use",
  ]) || /\b(?:por|poe|posiciona|posicione|posicionar|encosta|encoste|encostar|encostado)\b/.test(
    normalizedText,
  )
}

function hasSpecificCompositionDirection(text: string | null | undefined) {
  const normalized = normalizeSearchText(text || "")
  const compact = normalized.trim()

  if (!compact || compact === "imagem recebida" || isVagueCompositionRequest(compact)) {
    return false
  }

  const hasAction = hasVisualCompositionAction(normalized)
  const hasPlacement = includesAny(normalized, [
    "ambiente",
    "area",
    "chao",
    "direita",
    "esquerda",
    "fundo",
    "imagem",
    "parede",
    "piso",
    "teto",
    "foto",
    "sala",
    "cozinha",
    "banheiro",
    "quarto",
    "fachada",
    "bancada",
    "porta",
    "janela",
    "movel",
    "sofa",
  ])

  return hasAction && hasPlacement
}

function hasSubstantiveCompositionText(text: string | null | undefined) {
  const normalized = normalizeSearchText(text || "").trim()

  return Boolean(
    normalized &&
    normalized !== "imagem recebida" &&
    normalized !== "foto" &&
    normalized !== "imagem" &&
    !isVagueCompositionRequest(normalized)
  )
}

function isReferenceOnlyText(text: string | null | undefined) {
  const normalized = normalizeSearchText(text || "").trim()

  if (!normalized) {
    return false
  }

  return /^(referencia|referência|ref|imagem de referencia|foto de referencia|essa e a referencia|esta e a referencia|essa eh a referencia|esta eh a referencia|essa referencia|esta referencia)$/.test(normalized)
}

function classificationProvidesCompositionDirection(
  classification: AiClassificationResult,
  text: string | null | undefined,
) {
  if (!hasSubstantiveCompositionText(text) || isReferenceOnlyText(text) || isVagueCompositionRequest(text)) {
    return false
  }

  const missingInputs = classification.missing_inputs.map((input) => normalizeSearchText(input))
  const isMissingDirection = missingInputs.some((input) => (
    input.includes("direction") ||
    input.includes("direcao") ||
    input.includes("instru") ||
    input.includes("onde") ||
    input.includes("how_to_apply") ||
    input.includes("composition_direction")
  ))

  if (classification.intent !== "visual_edit" || isMissingDirection) {
    return false
  }

  if (classification.next_action === "create_composition_job") {
    return true
  }

  return classification.source === "openrouter" && classification.confidence >= 0.6
}

function hasCompositionDirection(texts: Array<string | null | undefined>) {
  return texts.some(hasSpecificCompositionDirection)
}

function isNewTopicRequest(text: string) {
  const normalized = normalizeSearchText(text)

  return includesAny(normalized, [
    "fazer uma nova imagem",
    "criar uma nova imagem",
    "gerar uma nova imagem",
    "fazer nova imagem",
    "criar nova imagem",
    "gerar nova imagem",
    "nova imagem",
    "comecar outro",
    "começar outro",
    "novo assunto",
    "nova conversa",
    "outro assunto",
    "outra coisa",
    "zerar",
    "limpar contexto",
  ])
}

function isResumeOnlyRequest(text: string) {
  const normalized = normalizeSearchText(text).trim()

  return /^(retomar|retoma|continuar|continua|vamos continuar|seguir|segue)$/.test(normalized)
}

function describeSessionForResume(session: InboxCompositionSession) {
  const product = session.selectedProducts[0]
  const parts: string[] = []

  if (product) {
    parts.push(`o produto ${product.name}${product.sku ? ` (${product.sku})` : ""}`)
  }

  if (session.workingImage?.imageUrl || session.workingImage?.jobId) {
    parts.push("a última imagem gerada")
  } else if (session.baseImage?.imageUrl || session.baseImage?.messageId) {
    parts.push("uma imagem base enviada")
  }

  if (parts.length === 0) {
    return ""
  }

  return `A gente tinha parado com ${parts.join(" e ")}. `
}

function buildResumePromptReply(session: InboxCompositionSession) {
  return [
    `${describeSessionForResume(session)}Quer retomar esse atendimento ou começar uma nova ideia?`,
    "Se quiser retomar, me diga diretamente o que quer alterar agora.",
    "Se for outro assunto, pode mandar o novo pedido ou enviar uma nova foto.",
  ].join("\n")
}

export async function processInboundMessageWithAi(input: {
  tenantSlug: string
  instance: StoredTenantChannelInstance
  conversationId: string
  message: InboxMessage | null
}) {
  if (!input.message || input.message.direction !== "inbound") {
    return { ok: true, skipped: "no_new_inbound_message" }
  }

  const inboundMessage = input.message
  const allMessages = await listInboxMessages(input.tenantSlug, input.conversationId)
  const conversation = await findInboxConversation(input.tenantSlug, input.conversationId)

  if (!conversation) {
    return { ok: false, skipped: "conversation_not_found" }
  }

  const contextResetTime = conversation.contextResetAt
    ? new Date(conversation.contextResetAt).getTime()
    : 0
  const messages = contextResetTime > 0
    ? allMessages.filter((message) => new Date(message.createdAt).getTime() >= contextResetTime || message.id === inboundMessage.id)
    : allMessages
  const conversationMessages = messages.slice(-10)
  let compositionSession = normalizeInboxCompositionSession(conversation.compositionSession)
  const pendingSessionPrompt = compositionSession.pendingPrompt?.trim()
  const previousMessage = getPreviousConversationMessage(messages, inboundMessage.id)
  const idleMs = previousMessage
    ? Math.max(0, getMessageTime(inboundMessage.createdAt) - getMessageTime(previousMessage.createdAt))
    : 0
  const isStaleConversationGap = idleMs >= STALE_CONVERSATION_MS
  const autoStartTrigger = getComoFicaTriggerMatch(inboundMessage.content)
  const autoStartRequested = Boolean(autoStartTrigger)
  const isOnlyAutoStartTrigger = Boolean(autoStartTrigger?.isOnlyTrigger)
  const settings = await getTenantSettings(input.tenantSlug)

  if (conversation.handledBy !== "ai" && !autoStartRequested) {
    return { ok: true, skipped: "operator_conversation" }
  }

  if (hasOutboundReplyAfterMessage(messages, inboundMessage)) {
    return { ok: true, skipped: "inbound_message_already_replied" }
  }

  if (shouldDeferAlbumImageReply(messages, inboundMessage)) {
    return { ok: true, skipped: "album_image_reply_deferred" }
  }

  if (!settings.channels.whatsappEnabled) {
    await recordAiTrace({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      messageId: input.message.id,
      stage: "automation",
      status: "warning",
      event: "automation_skipped_whatsapp_disabled",
      details: {
        handledBy: conversation.handledBy,
        state: conversation.state,
      },
    })

    return { ok: true, skipped: "whatsapp_disabled" }
  }

  if (conversation.handledBy !== "ai" && autoStartRequested) {
    await updateInboxConversation(input.tenantSlug, input.conversationId, {
      handledBy: "ai",
      status: "open",
      state: conversation.state,
    })
  }

  if (!settings.assistant.enabled) {
    await updateInboxConversation(input.tenantSlug, input.conversationId, {
      handledBy: "operator",
      status: "waiting_operator",
    })

    await recordAiTrace({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      messageId: input.message.id,
      stage: "automation",
      status: "warning",
      event: "automation_skipped_assistant_disabled",
      details: {
        handledBy: "operator",
      },
    })

    return { ok: true, skipped: "assistant_disabled" }
  }

  if (isLikelyExternalAutoReply(input.message.content)) {
    await updateInboxConversation(input.tenantSlug, input.conversationId, {
      handledBy: "operator",
      status: "waiting_operator",
      state: "idle",
    })

    await recordAiTrace({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      messageId: input.message.id,
      stage: "automation",
      status: "warning",
      event: "automation_skipped_external_auto_reply",
      details: {
        text: input.message.content.slice(0, 280),
      },
    })

    return { ok: true, skipped: "external_auto_reply" }
  }

  const catalogItems = settings.assistant.catalogEnabled
    ? filterCatalogItemsForAssistant(
      await listCatalogItems(input.tenantSlug),
      settings.assistant.catalogCategories,
    )
    : []
  const colorReferences = findCatalogColorReferences(catalogItems, input.message.content)
  const skuReference = findCatalogSkuReference(catalogItems, input.message.content)
  const productReferences = uniqueCatalogItems([
    ...(skuReference ? [skuReference] : []),
    ...findCatalogProductReferences(catalogItems, input.message.content),
  ])
  const sessionProductReference = !isStaleConversationGap && (
    conversation.state === "awaiting_base_image" ||
    compositionSession.step === "awaiting_base_image" ||
    compositionSession.step === "product_selected"
  )
    ? findSessionProductItem(compositionSession, catalogItems)
    : null
  const genericCatalogItems = getCatalogItemsForGenericRequest(catalogItems, messages, input.message.content)
  const catalogLinkRequested = settings.assistant.catalogEnabled && !skuReference && (
    isCatalogBrowseRequest(input.message.content) ||
    (genericCatalogItems.length > 0 && (
      isCatalogMoreRequest(input.message.content) ||
      isCatalogRepeatRequest(input.message.content)
    ))
  )
  const productReference = productReferences[0] ?? sessionProductReference ?? null
  const primaryReference = productReference
    ? { item: productReference, color: undefined as string | undefined }
    : colorReferences[0]
      ? { item: colorReferences[0].item, color: getPrimaryCatalogColor(colorReferences[0]) }
      : null
  const catalogReferenceItems = uniqueCatalogItems([
    ...productReferences,
    ...colorReferences.map((reference) => reference.item),
    ...genericCatalogItems,
  ])
  const handoffRequestedByKeyword = hasConfiguredHandoffKeyword(
    input.message.content,
    settings.assistant.humanHandoffKeywords,
  )
  const recentBaseImageMessages = getRecentBaseImageMessages(messages)
  const rawLatestBaseImageMessage = recentBaseImageMessages[0] ?? getLatestBaseImageMessage(messages)
  const storedSessionBaseImageMessage = compositionSession.baseImage?.messageId
    ? messages.find((message) => message.id === compositionSession.baseImage?.messageId) ?? null
    : null
  const latestBaseImageMessage = rawLatestBaseImageMessage?.id === inboundMessage.id
    ? rawLatestBaseImageMessage
    : storedSessionBaseImageMessage ?? rawLatestBaseImageMessage
  const effectiveLatestBaseImageMessage = latestBaseImageMessage
  const sessionReferenceImage = compositionSession.referenceImage
  const compositionJobs = await listCompositionJobs(input.tenantSlug)
  const contextCompositionJobs = contextResetTime > 0
    ? compositionJobs.filter((job) => new Date(job.createdAt).getTime() >= contextResetTime)
    : compositionJobs
  const recentCompletedCompositionJobs = getRecentCompletedCompositionJobs(
    contextCompositionJobs,
    input.conversationId,
  )
  const latestCompletedCompositionJob = recentCompletedCompositionJobs[0] ?? getLatestCompletedCompositionJob(
    contextCompositionJobs,
    input.conversationId,
  )
  const latestCompositionResultMessage = findCompositionResultMessage(messages, latestCompletedCompositionJob)
  const explicitBaseChoice = getExplicitCompositionBaseChoice(input.message.content)
  const hasSessionBaseImage = Boolean(compositionSession.baseImage?.imageUrl)
  const hasBaseImage = Boolean(effectiveLatestBaseImageMessage || hasSessionBaseImage)
  const currentMessageHasCatalogProduct = Boolean(
    skuReference ||
    productReferences.length > 0 ||
    colorReferences.length > 0
  )
  const currentMessageHasKnownVisualReference = Boolean(
    currentMessageHasCatalogProduct ||
    sessionReferenceImage
  )
  const currentMessageHasDirection = hasSpecificCompositionDirection(inboundMessage.content)
  const freeTextReference = getFreeTextReferenceForComposition({
    text: inboundMessage.content,
    hasKnownReference: currentMessageHasKnownVisualReference,
    hasDirection: currentMessageHasDirection,
  })
  const effectiveConversationState: InboxConversationState = conversation.state
  const artifactContext = buildArtifactContext({
    session: compositionSession,
    latestBaseImageMessage: effectiveLatestBaseImageMessage,
    recentBaseImageMessages,
    latestCompletedJob: latestCompletedCompositionJob,
    recentCompletedJobs: recentCompletedCompositionJobs,
    latestResultMessage: latestCompositionResultMessage,
    productReference,
    catalogReferences: catalogReferenceItems,
  })

  const classification = await classifyInboundMessage({
    tenantSlug: input.tenantSlug,
    text: input.message.content,
    mediaTypes: input.message.contentType === "text" ? [] : [input.message.contentType],
    conversationState: effectiveConversationState,
    catalogContext: [
      productReference ? `Produto citado diretamente: ${productReference.name}${productReference.sku ? ` SKU ${productReference.sku}` : ""} - ${productReference.description}` : "",
      colorReferences.length > 0 ? formatCatalogColorReferences(colorReferences) : "",
    ].filter(Boolean).join("\n"),
    artifactContext,
    hasBaseImage,
    recentMessages: conversationMessages.map((message) => ({
      role: message.role,
      content: formatMessageForAiContext(message, effectiveLatestBaseImageMessage?.id),
    })),
    modelProfileId: settings.assistant.modelProfileId,
    systemPrompt: getAssistantSystemPrompt(settings),
  })
  let nextAction = classification.next_action
  let reply = classification.reply?.trim() || getDefaultReply(nextAction)
  let compositionJobId: string | undefined
  const compositionBaseChoice: CompositionBaseChoice | null = explicitBaseChoice
  let shouldPersistCompositionSession = false
  const shouldIncludeWelcome = isFirstInboundMessage(messages, input.message.id)

  function setCompositionSession(updater: (session: InboxCompositionSession) => InboxCompositionSession) {
    compositionSession = {
      ...updater({
        ...compositionSession,
        selectedProducts: [...compositionSession.selectedProducts],
        changes: [...compositionSession.changes],
      }),
      updatedAt: new Date().toISOString(),
    }
    shouldPersistCompositionSession = true
  }

  const previousInboundImageMessage = recentBaseImageMessages.find((message) => message.id !== inboundMessage.id) ?? null
  const currentImageUrl = inboundMessage.contentType === "image"
    ? getMessageMediaUrl(input.tenantSlug, inboundMessage)
    : undefined

  if (currentImageUrl) {
    const currentImageIsReference = Boolean(
      previousInboundImageMessage ||
      compositionSession.baseImage?.imageUrl ||
      compositionSession.baseImage?.messageId
    )

    if (currentImageIsReference) {
      setCompositionSession((session) => ({
        ...session,
        referenceImage: {
          kind: "reference",
          messageId: inboundMessage.id,
          imageUrl: currentImageUrl,
          label: "imagem de referência enviada pelo cliente",
          createdAt: inboundMessage.createdAt,
        },
        pendingPrompt: undefined,
        pendingBaseChoice: false,
      }))
    } else {
      setCompositionSession((session) => ({
        ...session,
        baseImage: {
          kind: "base",
          messageId: inboundMessage.id,
          imageUrl: currentImageUrl,
          label: "imagem enviada pelo cliente",
          createdAt: inboundMessage.createdAt,
        },
        workingImage: undefined,
        preferredBase: undefined,
        pendingPrompt: undefined,
        pendingBaseChoice: false,
      }))
    }
  }

  if (primaryReference) {
    setCompositionSession((session) => ({
      ...session,
      selectedProducts: upsertSessionProduct(
        session,
        toSessionProduct(primaryReference.item, primaryReference.color),
      ),
      pendingBaseChoice: false,
    }))
  }

  const sessionReferenceForComposition = compositionSession.referenceImage?.imageUrl || compositionSession.referenceImage?.messageId
    ? compositionSession.referenceImage
    : null
  const hasReferenceForComposition = Boolean(
    primaryReference ||
    sessionReferenceForComposition ||
    freeTextReference
  )

  if (nextAction === "create_composition_job") {
    const compositionBase = await resolveCompositionBase({
      choice: compositionBaseChoice,
      latestBaseImageMessage: previousInboundImageMessage ?? effectiveLatestBaseImageMessage,
      latestResultMessage: latestCompositionResultMessage,
      latestCompletedJob: latestCompletedCompositionJob,
      session: compositionSession,
      tenantSlug: input.tenantSlug,
    })

    if (!compositionBase || !hasReferenceForComposition) {
      nextAction = "reply_in_chat"
      reply = classification.reply?.trim() || "Para criar a composição, me envie a imagem que você quer modificar e a referência que quer aplicar."
    } else {
      const clientReferenceForComposition = sessionReferenceForComposition
        ? {
          messageId: sessionReferenceForComposition.messageId,
          imageUrl: sessionReferenceForComposition.imageUrl,
          label: sessionReferenceForComposition.label || "imagem de referência enviada pelo cliente",
        }
        : null
      const visualReferences: CompositionJobReference[] = [
        ...(primaryReference ? [{
          source: "catalog" as const,
          catalogItemId: primaryReference.item.id,
          catalogItemName: primaryReference.item.name,
          catalogSku: primaryReference.item.sku,
          catalogCategory: primaryReference.item.category,
          catalogDescription: primaryReference.item.description,
        }] : []),
        ...(clientReferenceForComposition?.imageUrl ? [{
          source: "inbox" as const,
          messageId: clientReferenceForComposition.messageId,
          imageUrl: clientReferenceForComposition.imageUrl,
        }] : []),
      ]
      const referencePrompt = [
        primaryReference
          ? primaryReference.item.name + (primaryReference.color ? " - cor " + primaryReference.color : "")
          : "",
        clientReferenceForComposition
          ? clientReferenceForComposition.label + (clientReferenceForComposition.messageId ? " na mensagem " + clientReferenceForComposition.messageId : "")
          : "",
        freeTextReference ? "Referência textual descrita pelo cliente: " + freeTextReference : "",
      ].filter(Boolean).join("\n")
      const prompt = buildCompositionPrompt(inboundMessage, messages, referencePrompt)
      const result = await createCompositionJob(input.tenantSlug, {
        conversationId: conversation.id,
        channelInstanceId: conversation.channelInstanceId,
        contactName: conversation.contact.name,
        contactPhone: conversation.contact.phone,
        mode: classification.mode as CompositionMode | null,
        source: "ai",
        sourceMessageId: inboundMessage.id,
        baseMessageId: compositionBase.message?.id,
        baseImageUrl: compositionBase.imageUrl,
        referenceMessageId: clientReferenceForComposition?.messageId,
        referenceImageUrl: clientReferenceForComposition?.imageUrl,
        catalogItemId: primaryReference?.item.id,
        catalogItemName: primaryReference?.item.name,
        catalogColorReference: primaryReference?.color,
        references: visualReferences.length > 0 ? visualReferences : undefined,
        prompt,
      })
      const job = result.created
        ? await ensureCompositionBaseSnapshot(result.job).catch(async (error) => {
          await recordAiTrace({
            tenantSlug: input.tenantSlug,
            conversationId: conversation.id,
            jobId: result.job.id,
            stage: "composition",
            status: "warning",
            event: "composition_base_snapshot_failed",
            errorMessage: error instanceof Error ? error.message : "Falha ao persistir snapshot da imagem base.",
          })

          return result.job
        })
        : result.job

      compositionJobId = job.id
      setCompositionSession((session) => {
        const product = primaryReference
          ? toSessionProduct(primaryReference.item, primaryReference.color)
          : session.selectedProducts[0]
        const base: "original" | "result" = compositionBase.choice
        const status: "queued" | "failed" = job.status === "failed" ? "failed" : "queued"

        return {
          ...session,
          step: "composing",
          baseImage: compositionBase.message
            ? {
              kind: "base",
              messageId: compositionBase.message.id,
              imageUrl: compositionBase.imageUrl,
              label: compositionBase.label,
              createdAt: compositionBase.message.createdAt,
            }
            : session.baseImage,
          preferredBase: undefined,
          selectedProducts: product ? upsertSessionProduct(session, product) : session.selectedProducts,
          pendingPrompt: undefined,
          pendingBaseChoice: false,
          changes: [
            {
              id: crypto.randomUUID(),
              prompt,
              product,
              base,
              jobId: job.id,
              status,
              createdAt: job.createdAt,
            },
            ...session.changes.filter((change) => change.jobId !== job.id),
          ].slice(0, 20),
        }
      })
      if (job.status === "queued") {
        await enqueueProcessCompositionQueue(input.tenantSlug)
        scheduleAppJobProcessing()
      }
      reply = result.created
        ? "Criei a composição usando a " + compositionBase.label + " como base. ID do processo: " + job.id.slice(0, 8) + "."
        : "Essa composição já está na fila usando a " + compositionBase.label + " como base. ID do processo: " + job.id.slice(0, 8) + "."
    }
  }

  reply = withWelcomeMessage(reply, getWelcomeMessage(settings), shouldIncludeWelcome)

  const explicitHumanHandoff = handoffRequestedByKeyword || classification.intent === "human_handoff"

  if (!explicitHumanHandoff && settings.channels.handoffMode !== "auto" && nextAction === "handoff_to_operator") {
    nextAction = "reply_in_chat"
    reply = "Posso continuar te ajudando por aqui com a IA. Se quiser falar com um operador, me avise."
  }

  const shouldHandoffToOperator = explicitHumanHandoff || (
    settings.channels.handoffMode === "auto" && (
      classification.needs_human_review || nextAction === "handoff_to_operator"
    )
  )

  const nextHandledBy = shouldHandoffToOperator
    ? "operator"
    : "ai"
  const nextState = mapNextActionToState(nextAction)

  if (shouldPersistCompositionSession) {
    await updateInboxConversationCompositionSession(
      input.tenantSlug,
      input.conversationId,
      () => compositionSession,
    )
  }

  const providers = await readProviders()
  const provider = providers.find((item) => item.id === input.instance.providerId)

  if (!provider) {
    await updateInboxConversation(input.tenantSlug, input.conversationId, {
      handledBy: "operator",
      status: "waiting_operator",
      state: nextState,
    })

    await recordAiTrace({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      messageId: input.message.id,
      jobId: compositionJobId,
      stage: "automation",
      status: "error",
      event: "automation_provider_not_found",
      errorMessage: "Provider do canal nao encontrado.",
      details: {
        nextAction,
        handledBy: "operator",
        classification,
      },
    })

    return { ok: false, skipped: "provider_not_found", classification }
  }

  try {
    const sentPayload = await sendUazapiText(
      provider,
      input.instance.instanceToken,
      conversation.externalContactId,
      reply
    )
    const result = await appendAssistantInboxMessage({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      content: reply,
      providerMessageId: getProviderMessageId(sentPayload),
      state: nextState,
      handledBy: nextHandledBy,
    })

    if (!result) {
      await recordAiTrace({
        tenantSlug: input.tenantSlug,
        conversationId: input.conversationId,
        messageId: input.message.id,
        jobId: compositionJobId,
        stage: "automation",
        status: "error",
        event: "automation_append_failed",
        errorMessage: "Nao foi possivel anexar a mensagem da IA no inbox.",
        details: {
          nextAction,
          reply,
          classification,
        },
      })

      return { ok: false, skipped: "append_failed", classification }
    }

    await recordAiTrace({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      messageId: input.message.id,
      jobId: compositionJobId,
      stage: "automation",
      status: "success",
      event: "automation_reply_sent",
      details: {
        nextAction,
        nextState,
        handledBy: result.conversation.handledBy,
        compositionJobCreated: Boolean(compositionJobId),
        classification,
        reply,
      },
    })

    return {
      ok: true,
      classification: { ...classification, next_action: nextAction },
      compositionJobId,
      messageId: result.message.id,
      handledBy: result.conversation.handledBy,
    }
  } catch (error) {
    await updateInboxConversation(input.tenantSlug, input.conversationId, {
      handledBy: "operator",
      status: "waiting_operator",
      state: nextState,
    })

    await recordAiTrace({
      tenantSlug: input.tenantSlug,
      conversationId: input.conversationId,
      messageId: input.message.id,
      jobId: compositionJobId,
      stage: "automation",
      status: "error",
      event: "automation_send_failed",
      errorMessage: error instanceof Error ? error.message : "Nao foi possivel enviar resposta da IA.",
      details: {
        nextAction,
        nextState,
        classification,
        reply,
      },
    })

    return {
      ok: false,
      skipped: "send_failed",
      classification,
      error: error instanceof Error ? error.message : "Nao foi possivel enviar resposta da IA.",
    }
  }
}
