import type { NextAction } from "@studio/contracts"

import type { CatalogItem } from "@/lib/catalog-types"
import type { CompositionMode } from "@/lib/composition-types"
import type { InboxConversationState, InboxMessage } from "@/lib/inbox-types"
import { findCatalogColorReferences, formatCatalogColorReferences, getPrimaryCatalogColor } from "@/lib/server/catalog-color-utils"
import { readProviders } from "@/lib/server/channel-providers-store"
import { classifyInboundMessage } from "@/lib/server/ai-orchestrator"
import { createCompositionJob } from "@/lib/server/composition-jobs-store"
import { appendAssistantInboxMessage, findInboxConversation, listInboxMessages, updateInboxConversation } from "@/lib/server/inbox-store"
import { listCatalogItems } from "@/lib/server/catalog-store"
import type { StoredTenantChannelInstance } from "@/lib/server/tenant-channel-instances-store"
import { sendUazapiText } from "@/lib/server/uazapi-client"

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
    return "Me envie a imagem do ambiente ou produto que voce quer transformar."
  }

  if (nextAction === "ask_for_reference_image") {
    return "Recebi sua mensagem. Agora me diga qual estilo, produto ou referencia voce quer aplicar."
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

  return "Como posso ajudar com sua composicao visual?"
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

  return `${prompt}\nReferencia de catalogo: ${reference}`
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function uniqueWords(value: string) {
  return [...new Set(
    normalizeSearchText(value)
      .split(/[^a-z0-9]+/i)
      .map((word) => word.trim())
      .filter((word) => word.length >= 3)
  )]
}

function findCatalogProductReference(items: CatalogItem[], text: string) {
  const normalizedText = normalizeSearchText(text)

  return items
    .filter((item) => item.status === "active")
    .map((item) => {
      const normalizedName = normalizeSearchText(item.name)
      const normalizedSku = normalizeSearchText(item.sku || "")
      const searchable = normalizeSearchText([
        item.name,
        item.description,
        item.category,
        ...Object.entries(item.tags).flatMap(([key, value]) => [key, value]),
      ].join(" "))
      const nameWords = uniqueWords(item.name)
      const matchedNameWords = nameWords.filter((word) => normalizedText.includes(word))
      const score =
        (normalizedName && normalizedText.includes(normalizedName) ? 100 : 0) +
        (normalizedSku && normalizedText.includes(normalizedSku) ? 80 : 0) +
        (matchedNameWords.length >= 2 ? matchedNameWords.length * 12 : 0) +
        (normalizedText.includes("revestimento") && searchable.includes("revestimento") ? 8 : 0) +
        (normalizedText.includes("parede") && searchable.includes("parede") ? 5 : 0)

      return { item, score }
    })
    .filter((reference) => reference.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.item ?? null
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

export async function processInboundMessageWithAi(input: {
  tenantSlug: string
  instance: StoredTenantChannelInstance
  conversationId: string
  message: InboxMessage | null
}) {
  if (!input.message || input.message.direction !== "inbound") {
    return { ok: true, skipped: "no_new_inbound_message" }
  }

  const messages = await listInboxMessages(input.tenantSlug, input.conversationId)
  const conversationMessages = messages.slice(-10)
  const conversation = await findInboxConversation(input.tenantSlug, input.conversationId)

  if (!conversation) {
    return { ok: false, skipped: "conversation_not_found" }
  }

  if (conversation.handledBy !== "ai") {
    return { ok: true, skipped: "operator_conversation" }
  }

  const catalogItems = await listCatalogItems(input.tenantSlug)
  const colorReferences = findCatalogColorReferences(catalogItems, input.message.content)
  const productReference = findCatalogProductReference(catalogItems, input.message.content)
  const primaryReference = productReference
    ? { item: productReference, color: undefined as string | undefined }
    : colorReferences[0]
      ? { item: colorReferences[0].item, color: getPrimaryCatalogColor(colorReferences[0]) }
      : null
  const classification = await classifyInboundMessage({
    tenantSlug: input.tenantSlug,
    text: input.message.content,
    mediaTypes: input.message.contentType === "text" ? [] : [input.message.contentType],
    conversationState: conversation.state,
    catalogContext: [
      productReference ? `Produto citado diretamente: ${productReference.name}${productReference.sku ? ` SKU ${productReference.sku}` : ""} - ${productReference.description}` : "",
      colorReferences.length > 0 ? formatCatalogColorReferences(colorReferences) : "",
    ].filter(Boolean).join("\n"),
    recentMessages: conversationMessages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  })
  let nextAction = classification.next_action
  let reply = classification.reply?.trim() || getDefaultReply(nextAction)
  let compositionJobId: string | undefined
  const hasBaseImage = Boolean(getLatestBaseImageMessage(messages))

  if (isColorEditRequest(input.message.content) && colorReferences.length > 0 && !hasBaseImage) {
    nextAction = "show_catalog_options"
    reply = [
      "Encontrei estas referencias de tinta no catalogo para a cor solicitada:",
      formatCatalogColorReferences(colorReferences),
      "Envie a imagem do ambiente que voce quer alterar para eu aplicar a cor na parede.",
    ].join("\n\n")
  } else if (isColorEditRequest(input.message.content) && colorReferences.length > 0 && hasBaseImage) {
    nextAction = "create_composition_job"
  }

  if (nextAction === "create_composition_job") {
    const baseImageMessage = getLatestBaseImageMessage(messages)

    if (!baseImageMessage) {
      nextAction = "ask_for_base_image"
      reply = "Para criar a composicao, me envie primeiro a imagem do ambiente ou produto que voce quer transformar."
    } else {
      const result = await createCompositionJob(input.tenantSlug, {
        conversationId: conversation.id,
        channelInstanceId: conversation.channelInstanceId,
        contactName: conversation.contact.name,
        contactPhone: conversation.contact.phone,
        mode: classification.mode as CompositionMode | null,
        source: "ai",
        sourceMessageId: input.message.id,
        baseMessageId: baseImageMessage.id,
        baseImageUrl: getMessageMediaUrl(input.tenantSlug, baseImageMessage),
        catalogItemId: primaryReference?.item.id,
        catalogItemName: primaryReference?.item.name,
        catalogColorReference: primaryReference?.color,
        prompt: buildCompositionPrompt(
          input.message,
          messages,
          primaryReference
            ? `${primaryReference.item.name}${primaryReference.color ? ` - cor ${primaryReference.color}` : ""}`
            : ""
        ),
      })
      compositionJobId = result.job.id
      reply = result.created
        ? `Criei a composicao e ela entrou na fila. Vou preservar a estrutura do ambiente: angulo, perspectiva, janelas, portas e layout nao serao alterados. ID do job: ${result.job.id.slice(0, 8)}.`
        : `Essa composicao ja esta na fila. Vou preservar a estrutura do ambiente: angulo, perspectiva, janelas, portas e layout nao serao alterados. ID do job: ${result.job.id.slice(0, 8)}.`
    }
  }

  const nextHandledBy = nextAction === "handoff_to_operator" || classification.needs_human_review
    ? "operator"
    : "ai"
  const nextState = mapNextActionToState(nextAction)

  const providers = await readProviders()
  const provider = providers.find((item) => item.id === input.instance.providerId)

  if (!provider) {
    await updateInboxConversation(input.tenantSlug, input.conversationId, {
      handledBy: "operator",
      status: "waiting_operator",
      state: nextState,
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
      return { ok: false, skipped: "append_failed", classification }
    }

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

    return {
      ok: false,
      skipped: "send_failed",
      classification,
      error: error instanceof Error ? error.message : "Nao foi possivel enviar resposta da IA.",
    }
  }
}
