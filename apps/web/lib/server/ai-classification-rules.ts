import type { AiClassificationResult } from "@/lib/ai-types"

type DeterministicClassificationInput = {
  text?: string | null
  mediaTypes?: string[]
  conversationState?: string | null
  catalogContext?: string | null
  hasBaseImage?: boolean
}

type DeterministicOverride = {
  result: AiClassificationResult
  rule: string
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function hasAnyTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function isGreeting(text: string) {
  const compact = text.trim()

  return compact.length > 0 && compact.length <= 40 && hasAnyTerm(text, [
    "oi",
    "ola",
    "olá",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
  ])
}

function isHumanHandoffRequest(text: string) {
  return hasAnyTerm(text, [
    "humano",
    "atendente",
    "operador",
    "pessoa real",
    "vendedor",
    "supervisor",
  ])
}

function isVisualRequest(text: string) {
  return hasAnyTerm(text, [
    "composicao",
    "composição",
    "simulacao",
    "simulação",
    "render",
    "gerar imagem",
    "gerar uma imagem",
    "montagem",
    "mostrar como fica",
    "como ficaria",
    "como fica",
  ])
}

function isExistingImageEditRequest(text: string) {
  const hasEditAction = hasAnyTerm(text, [
    "apagar",
    "aplicar",
    "alterar",
    "colocar",
    "deletar",
    "eliminar",
    "excluir",
    "limpar",
    "mudar",
    "pintar",
    "remover",
    "retirar",
    "sumir",
    "substituir",
    "tirar",
    "trocar",
    "usar",
  ])
  const hasVisualTarget = hasAnyTerm(text, [
    "ambiente",
    "cadeira",
    "chao",
    "chão",
    "foto",
    "fundo",
    "imagem",
    "mesa",
    "movel",
    "moveis",
    "móvel",
    "móveis",
    "objeto",
    "objetos",
    "parede",
    "piso",
    "porta",
    "sofa",
    "sofá",
    "teto",
    "janela",
  ])

  return hasEditAction && hasVisualTarget
}

function isCatalogDrivenRequest(text: string) {
  const hasCatalogDisplayIntent = hasAnyTerm(text, [
    "catalogo",
    "opcoes",
    "opção",
    "opcao",
    "produto",
    "produtos",
    "referencia",
    "referencias",
    "quero ver",
    "mostrar",
    "mostra",
  ])
  const hasCompositionAction = hasAnyTerm(text, [
    "trocar",
    "mudar",
    "alterar",
    "usar",
    "aplicar",
    "colocar",
    "pintar",
  ])

  return hasCatalogDisplayIntent || hasCompositionAction
}

export function applyDeterministicClassificationRules(
  input: DeterministicClassificationInput,
  current: AiClassificationResult,
): DeterministicOverride | null {
  const normalizedText = normalizeText(input.text || "")
  const hasImage = (input.mediaTypes || []).includes("image")
  const hasCatalogContext = Boolean(input.catalogContext?.trim())
  const hasBaseImage = Boolean(input.hasBaseImage)
  const conversationState = input.conversationState || "idle"

  if (isHumanHandoffRequest(normalizedText)) {
    return {
      rule: "explicit_human_handoff",
      result: {
        ...current,
        intent: "human_handoff",
        mode: current.mode ?? null,
        next_action: "handoff_to_operator",
        confidence: Math.max(current.confidence, 0.9),
        needs_human_review: true,
        missing_inputs: [],
        rationale: "Regra deterministica: o cliente pediu atendimento humano de forma explicita.",
        reply: "Vou encaminhar seu atendimento para um operador continuar daqui.",
      },
    }
  }

  if (hasImage && !normalizedText.trim()) {
    return {
      rule: "image_without_instruction",
      result: {
        ...current,
        intent: "visual_edit",
        mode: current.mode ?? "interior",
        next_action: "ask_for_reference_image",
        confidence: Math.max(current.confidence, 0.88),
        needs_human_review: false,
        missing_inputs: ["catalog_product", "composition_direction"],
        rationale: "Regra deterministica: imagem recebida sem instrucao complementar.",
        reply: "Recebi sua imagem. Agora preciso que voce escolha no catalogo qual produto quer aplicar e me diga o que deseja fazer na imagem.",
      },
    }
  }

  if (!hasBaseImage && conversationState === "awaiting_base_image") {
    return {
      rule: "awaiting_base_image_without_image",
      result: {
        ...current,
        intent: "visual_edit",
        mode: current.mode ?? "interior",
        next_action: "ask_for_base_image",
        confidence: Math.max(current.confidence, 0.92),
        needs_human_review: false,
        missing_inputs: ["base_image"],
        rationale: "Regra deterministica: a conversa ainda depende da imagem base.",
        reply: "Me envie a imagem do ambiente ou produto que voce quer transformar para eu continuar.",
      },
    }
  }

  if (hasBaseImage && !hasImage && isExistingImageEditRequest(normalizedText)) {
    return {
      rule: "existing_base_image_edit_request",
      result: {
        ...current,
        intent: "visual_edit",
        mode: current.mode ?? "interior",
        next_action: hasCatalogContext ? "create_composition_job" : "ask_for_reference_image",
        confidence: Math.max(current.confidence, 0.93),
        needs_human_review: false,
        missing_inputs: hasCatalogContext ? [] : ["catalog_product"],
        rationale: "Regra deterministica: o cliente pediu uma alteracao na imagem enviada anteriormente.",
        reply: hasCatalogContext
          ? "Consigo usar a imagem que voce enviou anteriormente como base. Vou preparar essa edicao visual agora."
          : "Consigo usar a imagem que voce enviou anteriormente como base. Agora preciso que voce escolha no catalogo qual produto quer aplicar.",
      },
    }
  }

  if (hasCatalogContext && hasBaseImage && isCatalogDrivenRequest(normalizedText)) {
    return {
      rule: "catalog_request_with_base_image",
      result: {
        ...current,
        intent: "visual_edit",
        mode: current.mode ?? "interior",
        next_action: "create_composition_job",
        confidence: Math.max(current.confidence, 0.94),
        needs_human_review: false,
        missing_inputs: [],
        rationale: "Regra deterministica: ha imagem base e referencia de catalogo suficiente para gerar a composicao.",
        reply: "Tenho a imagem base e a referencia do catalogo. Vou preparar a composicao visual agora.",
      },
    }
  }

  if (hasCatalogContext && !hasBaseImage && isCatalogDrivenRequest(normalizedText)) {
    return {
      rule: "catalog_request_without_base_image",
      result: {
        ...current,
        intent: "visual_edit",
        mode: current.mode ?? "interior",
        next_action: "show_catalog_options",
        confidence: Math.max(current.confidence, 0.9),
        needs_human_review: false,
        missing_inputs: ["base_image"],
        rationale: "Regra deterministica: a referencia do catalogo foi identificada, mas ainda falta a imagem base do ambiente.",
        reply: "Encontrei a referencia do catalogo. Agora me envie a imagem do ambiente ou produto que voce quer transformar para eu aplicar essa opcao.",
      },
    }
  }

  if (!hasBaseImage && isVisualRequest(normalizedText)) {
    return {
      rule: "visual_request_without_base_image",
      result: {
        ...current,
        intent: "visual_edit",
        mode: current.mode ?? "interior",
        next_action: "ask_for_base_image",
        confidence: Math.max(current.confidence, 0.82),
        needs_human_review: false,
        missing_inputs: ["base_image"],
        rationale: "Regra deterministica: pedido visual sem imagem base.",
        reply: "Para montar a composicao, me envie primeiro a imagem do ambiente ou produto que voce quer transformar.",
      },
    }
  }

  if (isGreeting(normalizedText) && !hasImage) {
    return {
      rule: "short_greeting",
      result: {
        ...current,
        intent: "smalltalk",
        mode: null,
        next_action: "reply_in_chat",
        confidence: Math.max(current.confidence, 0.8),
        needs_human_review: false,
        missing_inputs: [],
        rationale: "Regra deterministica: saudacao curta sem contexto operacional.",
        reply: "Oi. Posso te ajudar a criar uma composicao visual, escolher um produto do catalogo ou avaliar uma imagem.",
      },
    }
  }

  return null
}
