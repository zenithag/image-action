import type { ClassificationResponse, Intent, Mode, NextAction } from "@studio/contracts"

import type { AiClassificationResult } from "@/lib/ai-types"
import { getAiModelProfile } from "@/lib/server/ai-model-profiles-store"
import { getActiveOpenRouterProvider } from "@/lib/server/ai-providers-store"
import { createOpenRouterChatCompletion } from "@/lib/server/openrouter-client"

type ClassificationInput = {
  tenantSlug: string
  text?: string | null
  mediaTypes?: string[]
  conversationState?: string | null
  catalogContext?: string | null
  recentMessages?: Array<{
    role: "customer" | "assistant" | "operator" | "system"
    content: string
  }>
}

const intents = new Set<Intent>(["visual_edit", "commercial_question", "smalltalk", "human_handoff"])
const nextActions = new Set<NextAction>([
  "reply_in_chat",
  "ask_for_base_image",
  "ask_for_reference_image",
  "create_composition_job",
  "handoff_to_operator",
  "show_catalog_options",
])
const modes = new Set<Mode>(["product", "interior", "print", "fashion"])

function firstJsonObject(value: string) {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Resposta da IA nao contem JSON.")
  }

  return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function normalizeClassification(parsed: Record<string, unknown>, source: ClassificationResponse["source"], model?: string): AiClassificationResult {
  const intent = intents.has(parsed.intent as Intent) ? parsed.intent as Intent : "smalltalk"
  const nextAction = nextActions.has(parsed.next_action as NextAction) ? parsed.next_action as NextAction : "reply_in_chat"
  const mode = modes.has(parsed.mode as Mode) ? parsed.mode as Mode : null
  const confidence = typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5
  const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : undefined

  return {
    intent,
    mode,
    next_action: nextAction,
    confidence,
    needs_human_review: Boolean(parsed.needs_human_review),
    missing_inputs: asStringArray(parsed.missing_inputs),
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "Classificacao normalizada pelo orquestrador.",
    source,
    reply,
    model,
  }
}

function heuristicClassification(input: ClassificationInput): AiClassificationResult {
  const text = (input.text || "").toLowerCase()
  const mediaTypes = new Set(input.mediaTypes || [])

  if (text.includes("humano") || text.includes("atendente") || text.includes("operador")) {
    return {
      intent: "human_handoff",
      mode: null,
      next_action: "handoff_to_operator",
      confidence: 0.75,
      needs_human_review: true,
      missing_inputs: [],
      rationale: "Cliente pediu atendimento humano.",
      source: "heuristic",
      reply: "Vou chamar um operador para continuar seu atendimento.",
    }
  }

  if (mediaTypes.has("image")) {
    return {
      intent: "visual_edit",
      mode: "interior",
      next_action: "ask_for_reference_image",
      confidence: 0.65,
      needs_human_review: false,
      missing_inputs: ["reference_image_or_style"],
      rationale: "Cliente enviou imagem; falta entender o estilo ou produto desejado.",
      source: "heuristic",
      reply: "Recebi sua imagem. Agora me diga qual estilo, produto ou alteracao voce quer aplicar.",
    }
  }

  if (text.includes("imagem") || text.includes("ambiente") || text.includes("render") || text.includes("composicao")) {
    return {
      intent: "visual_edit",
      mode: "interior",
      next_action: "ask_for_base_image",
      confidence: 0.7,
      needs_human_review: false,
      missing_inputs: ["base_image"],
      rationale: "Mensagem indica pedido de composicao visual, mas ainda nao ha imagem base.",
      source: "heuristic",
      reply: "Me envie a imagem do ambiente ou produto que voce quer transformar.",
    }
  }

  return {
    intent: "smalltalk",
    mode: null,
    next_action: "reply_in_chat",
    confidence: 0.45,
    needs_human_review: false,
    missing_inputs: [],
    rationale: "Fallback heuristico sem provider de IA configurado ou sem intencao clara.",
    source: "heuristic",
    reply: "Como posso ajudar com sua composicao visual?",
  }
}

export async function classifyInboundMessage(input: ClassificationInput): Promise<AiClassificationResult> {
  const provider = await getActiveOpenRouterProvider()
  const profile = await getAiModelProfile("classification")

  if (!provider || !profile) {
    return heuristicClassification(input)
  }

  const recentMessages = (input.recentMessages || [])
    .slice(-8)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")

  const systemPrompt = [
    "Voce e o orquestrador de IA do ComoFica.",
    "Classifique a mensagem recebida e escolha a proxima acao.",
    "Responda somente JSON valido, sem markdown.",
    "Campos obrigatorios: intent, mode, next_action, confidence, needs_human_review, missing_inputs, rationale, reply.",
    "Intents: visual_edit, commercial_question, smalltalk, human_handoff.",
    "Modes: product, interior, print, fashion ou null.",
    "Next actions: reply_in_chat, ask_for_base_image, ask_for_reference_image, create_composition_job, handoff_to_operator, show_catalog_options.",
    "Se o cliente pedir cor/tinta/produto e houver catalogContext relevante, prefira show_catalog_options ou create_composition_job se ja houver imagem base.",
  ].join("\n")

  const userPrompt = JSON.stringify({
    tenantSlug: input.tenantSlug,
    conversationState: input.conversationState || "idle",
    text: input.text || "",
    mediaTypes: input.mediaTypes || [],
    catalogContext: input.catalogContext || "",
    recentMessages,
  }, null, 2)

  try {
    const completion = await createOpenRouterChatCompletion({
      provider,
      profile,
      user: input.tenantSlug,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })
    const parsed = firstJsonObject(completion.content)

    return normalizeClassification(parsed, "openrouter", completion.model)
  } catch (error) {
    const fallback = heuristicClassification(input)

    return {
      ...fallback,
      needs_human_review: true,
      rationale: `${fallback.rationale} Falha OpenRouter: ${error instanceof Error ? error.message : "erro desconhecido"}`,
    }
  }
}
