import json
import logging

from app.orchestrator.openrouter_client import chat_completion

logger = logging.getLogger(__name__)

CLASSIFICATION_SYSTEM_PROMPT = """Voce e um assistente de classificacao de intencao para uma plataforma de composicao visual.

Analise a mensagem do cliente e o historico da conversa. Responda APENAS com JSON valido no formato:

{
  "intent": "visual_edit" | "commercial_question" | "smalltalk" | "human_handoff",
  "mode": "interior" | "product" | null,
  "next_action": "reply_in_chat" | "ask_for_base_image" | "ask_for_reference_image" | "create_composition_job" | "handoff_to_operator" | "show_catalog_options",
  "confidence": 0.0 a 1.0,
  "missing_inputs": [],
  "reply_text": "texto para enviar ao cliente",
  "extracted_tags": {}
}

Regras:
- Se o cliente quer trocar piso, parede, revestimento, tinta, movel em um ambiente: intent=visual_edit, mode=interior
- Se o cliente quer colocar um produto em uma foto: intent=visual_edit, mode=product
- Se o cliente faz pergunta comercial: intent=commercial_question
- Se o cliente quer falar com humano: intent=human_handoff
- Conversa informal: intent=smalltalk
- Se falta imagem base: next_action=ask_for_base_image
- Se tem imagem base mas falta preferencia: next_action=show_catalog_options, extraia tags (cor, material, estilo)
- Se tem tudo: next_action=create_composition_job
- Sempre inclua reply_text com a resposta para o cliente em portugues
- extracted_tags pode ter: cor, material, estilo, marca"""


async def classify_intent(messages_history: list[dict], current_state: str) -> dict:
    system_msg = {
        "role": "system",
        "content": CLASSIFICATION_SYSTEM_PROMPT + f"\n\nEstado atual da conversa: {current_state}",
    }

    llm_messages = [system_msg] + messages_history

    try:
        result = await chat_completion(
            llm_messages,
            response_format={"type": "json_object"},
        )
        parsed = json.loads(result["content"])
        parsed["_usage"] = result.get("usage", {})
        return parsed
    except (json.JSONDecodeError, KeyError, Exception) as e:
        logger.error("Intent classification failed: %s", e)
        return {
            "intent": "smalltalk",
            "mode": None,
            "next_action": "reply_in_chat",
            "confidence": 0.0,
            "missing_inputs": [],
            "reply_text": "Desculpe, nao entendi. Pode repetir?",
            "extracted_tags": {},
            "_usage": {},
        }
