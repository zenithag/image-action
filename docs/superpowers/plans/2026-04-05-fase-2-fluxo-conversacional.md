# Fase 2: Fluxo Conversacional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo completo de webhook WhatsApp ate resposta: gateway (normalizar, resolver tenant, persistir), orchestrator (classificar intencao, state machine), channel (enviar resposta), billing (registrar uso).

**Architecture:** Quatro novos modulos dentro de `services/api-server/app/`: gateway, orchestrator, channel, billing. Gateway recebe webhook e chama orchestrator internamente. Orchestrator chama OpenRouter para classificacao e usa state machine para decidir acao. Channel envia resposta via UAZAPI/WUZAPI HTTP API. Billing registra usage events. Novos repository functions adicionados em `core/repository.py` para queries adicionais.

**Tech Stack:** Python 3.12, FastAPI, httpx (OpenRouter + UAZAPI), psycopg 3 (async), pytest, pytest-asyncio, respx (mock HTTP)

---

## File Structure

### Novos arquivos

```
services/api-server/
├── app/
│   ├── gateway/
│   │   ├── __init__.py
│   │   ├── router.py           # POST /v1/webhooks/{provider}
│   │   ├── schemas.py          # WebhookPayload, normalizado
│   │   └── normalizer.py       # Normaliza UAZAPI/WUZAPI payload
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   ├── openrouter_client.py  # Wrapper httpx para OpenRouter
│   │   ├── intent.py           # Classificacao de intencao
│   │   ├── state_machine.py    # Transicoes de estado
│   │   └── conversation_handler.py  # Orquestra o fluxo completo
│   ├── channel/
│   │   ├── __init__.py
│   │   └── sender.py           # Envia mensagem via UAZAPI/WUZAPI
│   └── billing/
│       ├── __init__.py
│       └── tracker.py          # Registra UsageEvent
├── tests/
│   ├── test_gateway.py
│   ├── test_orchestrator.py
│   ├── test_state_machine.py
│   └── test_channel.py
```

### Arquivos modificados

```
services/api-server/app/main.py           # Registrar gateway router
services/api-server/app/config.py         # Adicionar uazapi_base_url
services/api-server/app/core/repository.py # Novas queries
```

---

## Task 1: Gateway — normalizer e schemas

**Files:**
- Create: `services/api-server/app/gateway/__init__.py`
- Create: `services/api-server/app/gateway/schemas.py`
- Create: `services/api-server/app/gateway/normalizer.py`
- Create: `services/api-server/tests/test_gateway.py`

- [ ] **Step 1: Criar gateway/__init__.py vazio**

- [ ] **Step 2: Criar gateway/schemas.py**

```python
from pydantic import BaseModel


class NormalizedInbound(BaseModel):
    provider: str
    external_session_id: str
    external_message_id: str
    external_contact_id: str
    contact_name: str
    phone: str | None = None
    text: str | None = None
    media: list[dict] = []
    raw_payload: dict = {}
```

- [ ] **Step 3: Criar gateway/normalizer.py**

```python
from app.gateway.schemas import NormalizedInbound


def normalize_uazapi(payload: dict) -> NormalizedInbound:
    data = payload.get("data", payload)
    message = data.get("message", data)
    key = data.get("key", {})

    text = None
    media = []

    if "conversation" in message:
        text = message["conversation"]
    elif "extendedTextMessage" in message:
        text = message["extendedTextMessage"].get("text")
    elif "imageMessage" in message:
        img = message["imageMessage"]
        text = img.get("caption")
        media.append({
            "mime_type": img.get("mimetype", "image/jpeg"),
            "url": img.get("url", ""),
            "caption": img.get("caption"),
            "kind": "image",
        })

    return NormalizedInbound(
        provider="uazapi",
        external_session_id=data.get("instance", ""),
        external_message_id=key.get("id", ""),
        external_contact_id=key.get("remoteJid", ""),
        contact_name=data.get("pushName", key.get("remoteJid", "")),
        phone=key.get("remoteJid", "").split("@")[0] if "@" in key.get("remoteJid", "") else None,
        text=text,
        media=media,
        raw_payload=payload,
    )


def normalize_wuzapi(payload: dict) -> NormalizedInbound:
    event = payload.get("event", {})
    info = event.get("info", {})
    msg = event.get("message", {})

    text = msg.get("conversation") or msg.get("extendedTextMessage", {}).get("text")
    media = []

    if "imageMessage" in msg:
        img = msg["imageMessage"]
        media.append({
            "mime_type": img.get("mimetype", "image/jpeg"),
            "url": img.get("url", ""),
            "caption": img.get("caption"),
            "kind": "image",
        })

    return NormalizedInbound(
        provider="wuzapi",
        external_session_id=payload.get("instance", ""),
        external_message_id=info.get("id", ""),
        external_contact_id=info.get("remoteJid", ""),
        contact_name=info.get("pushName", info.get("remoteJid", "")),
        phone=info.get("remoteJid", "").split("@")[0] if "@" in info.get("remoteJid", "") else None,
        text=text,
        media=media,
        raw_payload=payload,
    )


def normalize(provider: str, payload: dict) -> NormalizedInbound:
    if provider == "uazapi":
        return normalize_uazapi(payload)
    elif provider == "wuzapi":
        return normalize_wuzapi(payload)
    raise ValueError(f"Unknown provider: {provider}")
```

- [ ] **Step 4: Escrever testes do normalizer**

`services/api-server/tests/test_gateway.py`:
```python
import pytest
from app.gateway.normalizer import normalize


def test_normalize_uazapi_text():
    payload = {
        "data": {
            "instance": "session-demo-001",
            "key": {
                "id": "msg-001",
                "remoteJid": "5511999990000@s.whatsapp.net",
            },
            "pushName": "Cliente Teste",
            "message": {
                "conversation": "Oi, quero trocar o piso",
            },
        }
    }
    result = normalize("uazapi", payload)
    assert result.provider == "uazapi"
    assert result.external_session_id == "session-demo-001"
    assert result.external_contact_id == "5511999990000@s.whatsapp.net"
    assert result.contact_name == "Cliente Teste"
    assert result.text == "Oi, quero trocar o piso"
    assert result.phone == "5511999990000"
    assert result.media == []


def test_normalize_uazapi_image():
    payload = {
        "data": {
            "instance": "session-demo-001",
            "key": {
                "id": "msg-002",
                "remoteJid": "5511999990000@s.whatsapp.net",
            },
            "pushName": "Cliente Teste",
            "message": {
                "imageMessage": {
                    "mimetype": "image/jpeg",
                    "url": "https://example.com/image.jpg",
                    "caption": "Foto da sala",
                }
            },
        }
    }
    result = normalize("uazapi", payload)
    assert result.text == "Foto da sala"
    assert len(result.media) == 1
    assert result.media[0]["kind"] == "image"
    assert result.media[0]["mime_type"] == "image/jpeg"


def test_normalize_wuzapi_text():
    payload = {
        "instance": "session-demo-002",
        "event": {
            "info": {
                "id": "msg-003",
                "remoteJid": "5511999990001@s.whatsapp.net",
                "pushName": "Maria",
            },
            "message": {
                "conversation": "Quero ver opcoes de tinta",
            },
        }
    }
    result = normalize("wuzapi", payload)
    assert result.provider == "wuzapi"
    assert result.external_session_id == "session-demo-002"
    assert result.text == "Quero ver opcoes de tinta"
    assert result.contact_name == "Maria"


def test_normalize_unknown_provider():
    with pytest.raises(ValueError, match="Unknown provider"):
        normalize("telegram", {})
```

- [ ] **Step 5: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_gateway.py -v`
Expected: 4 tests PASSED

- [ ] **Step 6: Commit**

```bash
git add services/api-server/app/gateway/ services/api-server/tests/test_gateway.py
git commit -m "feat: gateway normalizer for UAZAPI and WUZAPI webhook payloads"
```

---

## Task 2: Repository — novas queries para o fluxo

**Files:**
- Modify: `services/api-server/app/core/repository.py`

- [ ] **Step 1: Adicionar novas funcoes ao repository**

Adicionar ao final de `services/api-server/app/core/repository.py`:

```python
async def get_channel_by_session(external_session_id: str) -> dict | None:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM tenant_channels WHERE external_session_id = %s AND status = 'connected'",
            (external_session_id,),
        )
        return await cur.fetchone()


async def upsert_contact(tenant_id: str, external_contact_id: str, display_name: str, phone: str | None) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO contacts (tenant_id, external_contact_id, display_name, phone)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (tenant_id, external_contact_id) DO UPDATE SET display_name = EXCLUDED.display_name
               RETURNING *""",
            (tenant_id, external_contact_id, display_name, phone),
        )
        return await cur.fetchone()


async def get_or_create_conversation(tenant_id: str, channel_id: str, contact_id: str) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """SELECT * FROM conversations
               WHERE tenant_id = %s AND channel_id = %s AND contact_id = %s AND status != 'closed'
               ORDER BY created_at DESC LIMIT 1""",
            (tenant_id, channel_id, contact_id),
        )
        row = await cur.fetchone()
        if row:
            return row
        cur = await conn.execute(
            """INSERT INTO conversations (tenant_id, channel_id, contact_id)
               VALUES (%s, %s, %s) RETURNING *""",
            (tenant_id, channel_id, contact_id),
        )
        return await cur.fetchone()


async def update_conversation_state(conversation_id: str, state: str) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            "UPDATE conversations SET state = %s WHERE id = %s RETURNING *",
            (state, conversation_id),
        )
        return await cur.fetchone()


async def update_conversation_handled_by(conversation_id: str, handled_by: str, operator_id: str | None = None) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            "UPDATE conversations SET handled_by = %s, operator_id = %s WHERE id = %s RETURNING *",
            (handled_by, operator_id, conversation_id),
        )
        return await cur.fetchone()


async def list_messages(conversation_id: str, limit: int = 20) -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM messages WHERE conversation_id = %s ORDER BY created_at DESC LIMIT %s",
            (conversation_id, limit),
        )
        rows = await cur.fetchall()
        return list(reversed(rows))


async def create_usage_event(
    tenant_id: str, kind: str, provider: str,
    reference_id: str | None, quantity: float,
    unit_cost: float, total_cost: float, metadata_json: dict | None = None,
) -> dict:
    meta = json.dumps(metadata_json) if metadata_json else "{}"
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO usage_events
               (tenant_id, kind, provider, reference_id, quantity, unit_cost, total_cost, metadata_json)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb) RETURNING *""",
            (tenant_id, kind, provider, reference_id, quantity, unit_cost, total_cost, meta),
        )
        return await cur.fetchone()


async def create_composition_job(
    tenant_id: str, conversation_id: str, mode: str,
    base_asset_id: str, catalog_item_id: str | None = None,
    overlay_asset_id: str | None = None, input_payload: dict | None = None,
) -> dict:
    payload = json.dumps(input_payload) if input_payload else "{}"
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO composition_jobs
               (tenant_id, conversation_id, mode, base_asset_id, catalog_item_id, overlay_asset_id, input_payload)
               VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb) RETURNING *""",
            (tenant_id, conversation_id, mode, base_asset_id, catalog_item_id, overlay_asset_id, payload),
        )
        return await cur.fetchone()
```

- [ ] **Step 2: Commit**

```bash
git add services/api-server/app/core/repository.py
git commit -m "feat: add repository functions for gateway, orchestrator, and billing flows"
```

---

## Task 3: OpenRouter client

**Files:**
- Create: `services/api-server/app/orchestrator/__init__.py`
- Create: `services/api-server/app/orchestrator/openrouter_client.py`
- Create: `services/api-server/tests/test_orchestrator.py`

- [ ] **Step 1: Criar orchestrator/__init__.py vazio**

- [ ] **Step 2: Criar openrouter_client.py**

```python
import httpx

from app.config import settings


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
) -> dict:
    model = model or settings.openrouter_model
    url = "https://openrouter.ai/api/v1/chat/completions"

    body: dict = {
        "model": model,
        "messages": messages,
    }
    if response_format:
        body["response_format"] = response_format

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            json=body,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    choice = data["choices"][0]
    return {
        "content": choice["message"]["content"],
        "model": data.get("model", model),
        "usage": data.get("usage", {}),
    }
```

- [ ] **Step 3: Escrever teste com mock HTTP**

Primeiro, adicionar `respx` ao dev dependencies em `pyproject.toml`:

Na secao `[project.optional-dependencies]` de `services/api-server/pyproject.toml`, adicionar `"respx>=0.22.0"` ao array `dev`.

`services/api-server/tests/test_orchestrator.py`:
```python
import json
import pytest
import respx
from httpx import Response

from app.orchestrator.openrouter_client import chat_completion


@pytest.mark.anyio
@respx.mock
async def test_chat_completion():
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{"message": {"content": "Ola! Como posso ajudar?"}}],
            "model": "openai/gpt-4.1-mini",
            "usage": {"prompt_tokens": 10, "completion_tokens": 8},
        })
    )

    result = await chat_completion([
        {"role": "user", "content": "Oi"},
    ])
    assert result["content"] == "Ola! Como posso ajudar?"
    assert result["usage"]["prompt_tokens"] == 10


@pytest.mark.anyio
@respx.mock
async def test_chat_completion_with_json_format():
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{"message": {"content": json.dumps({"intent": "visual_edit"})}}],
            "model": "openai/gpt-4.1-mini",
            "usage": {"prompt_tokens": 15, "completion_tokens": 5},
        })
    )

    result = await chat_completion(
        [{"role": "user", "content": "Quero trocar o piso"}],
        response_format={"type": "json_object"},
    )
    parsed = json.loads(result["content"])
    assert parsed["intent"] == "visual_edit"
```

- [ ] **Step 4: Instalar respx e rodar testes**

Run: `cd services/api-server && pip install -e ".[dev]"`
Run: `cd services/api-server && python -m pytest tests/test_orchestrator.py -v`
Expected: 2 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add services/api-server/app/orchestrator/ services/api-server/tests/test_orchestrator.py services/api-server/pyproject.toml
git commit -m "feat: OpenRouter client wrapper with httpx and JSON format support"
```

---

## Task 4: Intent classification

**Files:**
- Create: `services/api-server/app/orchestrator/intent.py`
- Modify: `services/api-server/tests/test_orchestrator.py`

- [ ] **Step 1: Criar intent.py**

```python
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
```

- [ ] **Step 2: Adicionar teste de classificacao**

Adicionar ao final de `services/api-server/tests/test_orchestrator.py`:

```python
from app.orchestrator.intent import classify_intent


@pytest.mark.anyio
@respx.mock
async def test_classify_intent_visual_edit():
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{"message": {"content": json.dumps({
                "intent": "visual_edit",
                "mode": "interior",
                "next_action": "ask_for_base_image",
                "confidence": 0.9,
                "missing_inputs": ["base_image"],
                "reply_text": "Claro! Pode me enviar uma foto do ambiente?",
                "extracted_tags": {},
            })}}],
            "model": "openai/gpt-4.1-mini",
            "usage": {"prompt_tokens": 50, "completion_tokens": 30},
        })
    )

    result = await classify_intent(
        [{"role": "user", "content": "Quero trocar o piso da minha sala"}],
        "idle",
    )
    assert result["intent"] == "visual_edit"
    assert result["mode"] == "interior"
    assert result["next_action"] == "ask_for_base_image"


@pytest.mark.anyio
@respx.mock
async def test_classify_intent_fallback_on_error():
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(500)
    )

    result = await classify_intent(
        [{"role": "user", "content": "oi"}],
        "idle",
    )
    assert result["intent"] == "smalltalk"
    assert result["confidence"] == 0.0
```

- [ ] **Step 3: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_orchestrator.py -v`
Expected: 4 tests PASSED

- [ ] **Step 4: Commit**

```bash
git add services/api-server/app/orchestrator/intent.py services/api-server/tests/test_orchestrator.py
git commit -m "feat: intent classification via OpenRouter with JSON schema"
```

---

## Task 5: State machine

**Files:**
- Create: `services/api-server/app/orchestrator/state_machine.py`
- Create: `services/api-server/tests/test_state_machine.py`

- [ ] **Step 1: Criar state_machine.py**

```python
from dataclasses import dataclass


@dataclass
class Transition:
    next_state: str
    action: str


TRANSITIONS: dict[str, dict[str, Transition]] = {
    "idle": {
        "visual_edit": Transition(next_state="awaiting_base_image", action="ask_for_base_image"),
        "commercial_question": Transition(next_state="idle", action="reply_in_chat"),
        "smalltalk": Transition(next_state="idle", action="reply_in_chat"),
        "human_handoff": Transition(next_state="idle", action="handoff_to_operator"),
    },
    "awaiting_base_image": {
        "image_received": Transition(next_state="collecting_preferences", action="ask_preferences"),
        "text_received": Transition(next_state="awaiting_base_image", action="ask_for_base_image"),
    },
    "collecting_preferences": {
        "preferences_collected": Transition(next_state="showing_options", action="show_catalog_options"),
        "text_received": Transition(next_state="collecting_preferences", action="ask_preferences"),
    },
    "showing_options": {
        "options_sent": Transition(next_state="awaiting_selection", action="wait_selection"),
    },
    "awaiting_selection": {
        "selection_made": Transition(next_state="composing", action="create_composition_job"),
        "text_received": Transition(next_state="awaiting_selection", action="ask_selection"),
    },
    "composing": {
        "job_completed": Transition(next_state="completed", action="send_result"),
        "job_failed": Transition(next_state="completed", action="notify_failure"),
    },
    "completed": {
        "new_request": Transition(next_state="idle", action="reset"),
        "more_options": Transition(next_state="showing_options", action="show_catalog_options"),
    },
}


def get_transition(current_state: str, event: str) -> Transition | None:
    state_transitions = TRANSITIONS.get(current_state, {})
    return state_transitions.get(event)


def determine_event(current_state: str, intent: dict, has_image: bool) -> str:
    if current_state == "idle":
        return intent.get("intent", "smalltalk")

    if current_state == "awaiting_base_image":
        return "image_received" if has_image else "text_received"

    if current_state == "collecting_preferences":
        tags = intent.get("extracted_tags", {})
        if tags:
            return "preferences_collected"
        return "text_received"

    if current_state == "awaiting_selection":
        next_action = intent.get("next_action", "")
        if next_action == "create_composition_job":
            return "selection_made"
        return "text_received"

    if current_state == "completed":
        if intent.get("intent") == "visual_edit":
            return "new_request"
        if intent.get("next_action") == "show_catalog_options":
            return "more_options"
        return "new_request"

    return "text_received"
```

- [ ] **Step 2: Escrever testes**

`services/api-server/tests/test_state_machine.py`:
```python
from app.orchestrator.state_machine import get_transition, determine_event


def test_idle_visual_edit():
    t = get_transition("idle", "visual_edit")
    assert t is not None
    assert t.next_state == "awaiting_base_image"
    assert t.action == "ask_for_base_image"


def test_idle_smalltalk():
    t = get_transition("idle", "smalltalk")
    assert t is not None
    assert t.next_state == "idle"
    assert t.action == "reply_in_chat"


def test_idle_handoff():
    t = get_transition("idle", "human_handoff")
    assert t is not None
    assert t.action == "handoff_to_operator"


def test_awaiting_base_image_with_image():
    t = get_transition("awaiting_base_image", "image_received")
    assert t is not None
    assert t.next_state == "collecting_preferences"


def test_awaiting_base_image_without_image():
    t = get_transition("awaiting_base_image", "text_received")
    assert t is not None
    assert t.next_state == "awaiting_base_image"


def test_collecting_preferences_done():
    t = get_transition("collecting_preferences", "preferences_collected")
    assert t is not None
    assert t.next_state == "showing_options"


def test_awaiting_selection_made():
    t = get_transition("awaiting_selection", "selection_made")
    assert t is not None
    assert t.next_state == "composing"


def test_composing_job_completed():
    t = get_transition("composing", "job_completed")
    assert t is not None
    assert t.next_state == "completed"


def test_completed_new_request():
    t = get_transition("completed", "new_request")
    assert t is not None
    assert t.next_state == "idle"


def test_determine_event_idle():
    event = determine_event("idle", {"intent": "visual_edit"}, False)
    assert event == "visual_edit"


def test_determine_event_awaiting_image_with_image():
    event = determine_event("awaiting_base_image", {}, True)
    assert event == "image_received"


def test_determine_event_awaiting_image_without_image():
    event = determine_event("awaiting_base_image", {}, False)
    assert event == "text_received"


def test_determine_event_collecting_with_tags():
    event = determine_event("collecting_preferences", {"extracted_tags": {"cor": "claro"}}, False)
    assert event == "preferences_collected"


def test_determine_event_collecting_without_tags():
    event = determine_event("collecting_preferences", {"extracted_tags": {}}, False)
    assert event == "text_received"
```

- [ ] **Step 3: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_state_machine.py -v`
Expected: 14 tests PASSED

- [ ] **Step 4: Commit**

```bash
git add services/api-server/app/orchestrator/state_machine.py services/api-server/tests/test_state_machine.py
git commit -m "feat: conversation state machine with transitions and event determination"
```

---

## Task 6: Channel sender

**Files:**
- Create: `services/api-server/app/channel/__init__.py`
- Create: `services/api-server/app/channel/sender.py`
- Modify: `services/api-server/app/config.py`
- Create: `services/api-server/tests/test_channel.py`

- [ ] **Step 1: Adicionar config de UAZAPI**

Adicionar em `services/api-server/app/config.py`, na classe `Settings`:

```python
    uazapi_base_url: str = "http://localhost:8080"
    uazapi_api_key: str = ""
```

- [ ] **Step 2: Criar channel/__init__.py vazio**

- [ ] **Step 3: Criar channel/sender.py**

```python
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_text(
    provider: str,
    external_session_id: str,
    remote_jid: str,
    text: str,
) -> dict | None:
    if provider == "uazapi":
        return await _send_uazapi_text(external_session_id, remote_jid, text)
    logger.warning("Send not implemented for provider: %s", provider)
    return None


async def send_image(
    provider: str,
    external_session_id: str,
    remote_jid: str,
    image_url: str,
    caption: str | None = None,
) -> dict | None:
    if provider == "uazapi":
        return await _send_uazapi_image(external_session_id, remote_jid, image_url, caption)
    logger.warning("Send not implemented for provider: %s", provider)
    return None


async def _send_uazapi_text(session_id: str, remote_jid: str, text: str) -> dict:
    url = f"{settings.uazapi_base_url}/message/sendText/{session_id}"
    body = {
        "number": remote_jid,
        "text": text,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url, json=body,
            headers={"apikey": settings.uazapi_api_key},
        )
        resp.raise_for_status()
        return resp.json()


async def _send_uazapi_image(
    session_id: str, remote_jid: str, image_url: str, caption: str | None,
) -> dict:
    url = f"{settings.uazapi_base_url}/message/sendImage/{session_id}"
    body: dict = {
        "number": remote_jid,
        "imageUrl": image_url,
    }
    if caption:
        body["caption"] = caption

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url, json=body,
            headers={"apikey": settings.uazapi_api_key},
        )
        resp.raise_for_status()
        return resp.json()
```

- [ ] **Step 4: Escrever testes**

`services/api-server/tests/test_channel.py`:
```python
import pytest
import respx
from httpx import Response

from app.channel.sender import send_text, send_image


@pytest.mark.anyio
@respx.mock
async def test_send_text_uazapi():
    respx.post("http://localhost:8080/message/sendText/session-001").mock(
        return_value=Response(200, json={"status": "sent", "id": "msg-out-001"})
    )
    result = await send_text(
        "uazapi", "session-001", "5511999990000@s.whatsapp.net", "Ola!",
    )
    assert result["status"] == "sent"


@pytest.mark.anyio
@respx.mock
async def test_send_image_uazapi():
    respx.post("http://localhost:8080/message/sendImage/session-001").mock(
        return_value=Response(200, json={"status": "sent", "id": "msg-out-002"})
    )
    result = await send_image(
        "uazapi", "session-001", "5511999990000@s.whatsapp.net",
        "https://storage.example.com/img.jpg", "Veja o resultado!",
    )
    assert result["status"] == "sent"


@pytest.mark.anyio
async def test_send_text_unknown_provider():
    result = await send_text(
        "telegram", "session-001", "123", "Ola!",
    )
    assert result is None
```

- [ ] **Step 5: Rodar testes**

Run: `cd services/api-server && python -m pytest tests/test_channel.py -v`
Expected: 3 tests PASSED

- [ ] **Step 6: Commit**

```bash
git add services/api-server/app/channel/ services/api-server/app/config.py services/api-server/tests/test_channel.py
git commit -m "feat: channel sender for UAZAPI text and image messages"
```

---

## Task 7: Billing tracker

**Files:**
- Create: `services/api-server/app/billing/__init__.py`
- Create: `services/api-server/app/billing/tracker.py`

- [ ] **Step 1: Criar billing/__init__.py vazio**

- [ ] **Step 2: Criar billing/tracker.py**

```python
import logging

from app.core import repository as repo

logger = logging.getLogger(__name__)


async def track_llm_usage(
    tenant_id: str,
    conversation_id: str,
    usage: dict,
    model: str = "openrouter",
) -> None:
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = prompt_tokens + completion_tokens

    if total_tokens == 0:
        return

    await repo.create_usage_event(
        tenant_id=tenant_id,
        kind="llm_tokens",
        provider=model,
        reference_id=conversation_id,
        quantity=float(total_tokens),
        unit_cost=0.0,
        total_cost=0.0,
        metadata_json={
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
        },
    )
    logger.info("Tracked %d tokens for tenant %s", total_tokens, tenant_id)


async def track_message_sent(tenant_id: str, conversation_id: str, provider: str) -> None:
    await repo.create_usage_event(
        tenant_id=tenant_id,
        kind="message_sent",
        provider=provider,
        reference_id=conversation_id,
        quantity=1.0,
        unit_cost=0.0,
        total_cost=0.0,
    )
```

- [ ] **Step 3: Commit**

```bash
git add services/api-server/app/billing/
git commit -m "feat: billing tracker for LLM tokens and message usage events"
```

---

## Task 8: Conversation handler (orquestra o fluxo)

**Files:**
- Create: `services/api-server/app/orchestrator/conversation_handler.py`

- [ ] **Step 1: Criar conversation_handler.py**

```python
import logging

from app.core import repository as repo
from app.catalog import repository as catalog_repo
from app.gateway.schemas import NormalizedInbound
from app.orchestrator.intent import classify_intent
from app.orchestrator.state_machine import determine_event, get_transition
from app.channel import sender
from app.billing import tracker

logger = logging.getLogger(__name__)


async def handle_inbound(inbound: NormalizedInbound) -> dict:
    # 1. Resolve tenant by channel session
    channel = await repo.get_channel_by_session(inbound.external_session_id)
    if not channel:
        logger.warning("No channel found for session: %s", inbound.external_session_id)
        return {"status": "ignored", "reason": "channel_not_found"}

    tenant_id = str(channel["tenant_id"])
    channel_id = str(channel["id"])
    provider = channel["provider"]

    # 2. Upsert contact
    contact = await repo.upsert_contact(
        tenant_id, inbound.external_contact_id, inbound.contact_name, inbound.phone,
    )
    contact_id = str(contact["id"])

    # 3. Get or create conversation
    conversation = await repo.get_or_create_conversation(tenant_id, channel_id, contact_id)
    conversation_id = str(conversation["id"])
    current_state = conversation["state"]

    # 4. Persist inbound message
    content = inbound.text or "[media]"
    content_type = "image" if inbound.media else "text"
    await repo.create_message(
        tenant_id, conversation_id, "inbound", "customer",
        content, content_type, inbound.external_message_id,
    )

    # 5. Persist assets if media present
    has_image = False
    for media_item in inbound.media:
        storage_key = f"tenants/{tenant_id}/conversations/{conversation_id}/{inbound.external_message_id}"
        await repo.create_asset(
            tenant_id, media_item.get("kind", "attachment"),
            media_item.get("mime_type", "image/jpeg"), storage_key,
            conversation_id, {"url": media_item.get("url", "")},
        )
        if media_item.get("kind") == "image":
            has_image = True

    # 6. Check handled_by
    if conversation["handled_by"] == "operator":
        logger.info("Conversation %s handled by operator, skipping AI", conversation_id)
        return {"status": "operator_handled", "conversation_id": conversation_id}

    # 7. Build message history for LLM
    messages = await repo.list_messages(conversation_id, limit=20)
    llm_history = []
    for msg in messages:
        role = "user" if msg["role"] == "customer" else "assistant"
        llm_history.append({"role": role, "content": msg["content"]})

    # 8. Classify intent
    intent_result = await classify_intent(llm_history, current_state)

    # 9. Track LLM usage
    await tracker.track_llm_usage(
        tenant_id, conversation_id, intent_result.get("_usage", {}),
    )

    # 10. Determine event and transition
    event = determine_event(current_state, intent_result, has_image)
    transition = get_transition(current_state, event)

    if transition:
        await repo.update_conversation_state(conversation_id, transition.next_state)
        logger.info(
            "Conversation %s: %s -> %s (event=%s)",
            conversation_id, current_state, transition.next_state, event,
        )

    # 11. Handle special actions
    if transition and transition.action == "handoff_to_operator":
        await repo.update_conversation_handled_by(conversation_id, "operator")
        reply_text = intent_result.get("reply_text", "Vou transferir voce para um atendente.")
    elif transition and transition.action == "show_catalog_options":
        tags = intent_result.get("extracted_tags", {})
        reply_text = await _send_catalog_options(
            tenant_id, conversation_id, tags, provider,
            inbound.external_session_id, inbound.external_contact_id,
        )
    elif transition and transition.action == "create_composition_job":
        reply_text = intent_result.get("reply_text", "Estou gerando a composicao, aguarde um momento...")
        # Job creation would need base_asset_id - for now just log
        logger.info("Would create composition job for conversation %s", conversation_id)
    else:
        reply_text = intent_result.get("reply_text", "")

    # 12. Send reply
    if reply_text:
        await sender.send_text(
            provider, inbound.external_session_id,
            inbound.external_contact_id, reply_text,
        )
        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            reply_text, "text", None,
        )
        await tracker.track_message_sent(tenant_id, conversation_id, provider)

    return {
        "status": "processed",
        "conversation_id": conversation_id,
        "state": transition.next_state if transition else current_state,
        "intent": intent_result.get("intent"),
    }


async def _send_catalog_options(
    tenant_id: str,
    conversation_id: str,
    tags: dict,
    provider: str,
    session_id: str,
    remote_jid: str,
) -> str:
    tag_filters = {k: v for k, v in tags.items() if v} if tags else None
    items = await catalog_repo.list_items(tenant_id, tag_filters)

    if not items:
        return "Nao encontrei opcoes com essas caracteristicas. Pode descrever de outra forma?"

    items = items[:5]  # max 5 options

    lines = ["Encontrei estas opcoes para voce:\n"]
    for i, item in enumerate(items, 1):
        name = item["name"]
        desc = item.get("description", "")
        lines.append(f"{i}. *{name}*")
        if desc:
            lines.append(f"   {desc}")

    lines.append("\nQual opcao voce prefere? Responda com o numero.")

    reply = "\n".join(lines)

    await repo.create_message(
        tenant_id, conversation_id, "outbound", "assistant",
        reply, "catalog_options", None,
    )

    return reply
```

- [ ] **Step 2: Commit**

```bash
git add services/api-server/app/orchestrator/conversation_handler.py
git commit -m "feat: conversation handler orchestrating gateway, intent, state machine, channel, billing"
```

---

## Task 9: Gateway router (endpoint de webhook)

**Files:**
- Create: `services/api-server/app/gateway/router.py`
- Modify: `services/api-server/app/main.py`

- [ ] **Step 1: Criar gateway/router.py**

```python
import logging

from fastapi import APIRouter, Request, Response

from app.gateway.normalizer import normalize
from app.orchestrator.conversation_handler import handle_inbound

logger = logging.getLogger(__name__)

router = APIRouter(tags=["gateway"])


@router.post("/webhooks/{provider}")
async def receive_webhook(provider: str, request: Request):
    if provider not in ("uazapi", "wuzapi"):
        return Response(status_code=400, content="Unknown provider")

    payload = await request.json()
    logger.info("Webhook received from %s", provider)

    try:
        inbound = normalize(provider, payload)
    except Exception as e:
        logger.error("Failed to normalize webhook: %s", e)
        return {"status": "error", "detail": "normalization_failed"}

    if not inbound.text and not inbound.media:
        logger.info("Ignoring non-message webhook (status update, etc.)")
        return {"status": "ignored", "reason": "no_content"}

    result = await handle_inbound(inbound)
    return result
```

- [ ] **Step 2: Registrar gateway router no main.py**

Adicionar em `services/api-server/app/main.py`, dentro de `create_app()`, apos os includes existentes:

```python
    from app.gateway.router import router as gateway_router
    app.include_router(gateway_router, prefix="/v1")
```

- [ ] **Step 3: Commit**

```bash
git add services/api-server/app/gateway/router.py services/api-server/app/main.py
git commit -m "feat: webhook endpoint POST /v1/webhooks/{provider} with full flow"
```

---

## Task 10: Teste de integracao do fluxo completo

**Files:**
- Create: `services/api-server/tests/test_webhook_flow.py`

- [ ] **Step 1: Escrever teste end-to-end**

```python
import json
import pytest
import respx
from httpx import Response


@pytest.fixture
async def seeded_tenant(client):
    """Cria tenant + channel conectado para testes de webhook."""
    t = await client.post("/v1/tenants", json={
        "name": "Webhook Corp", "slug": "webhook-corp", "plan_code": "starter",
    })
    tenant = t.json()
    ch = await client.post(f"/v1/tenants/{tenant['id']}/channels", json={
        "channel_type": "whatsapp",
        "provider": "uazapi",
        "external_session_id": "session-webhook-test",
    })
    channel = ch.json()
    # Manually set channel to connected
    from app.db import get_conn
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE tenant_channels SET status = 'connected' WHERE id = %s",
            (channel["id"],),
        )
    return {"tenant": tenant, "channel": channel}


@pytest.mark.anyio
@respx.mock
async def test_full_webhook_flow(client, seeded_tenant):
    # Mock OpenRouter
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{"message": {"content": json.dumps({
                "intent": "visual_edit",
                "mode": "interior",
                "next_action": "ask_for_base_image",
                "confidence": 0.9,
                "missing_inputs": ["base_image"],
                "reply_text": "Claro! Pode me enviar uma foto do ambiente?",
                "extracted_tags": {},
            })}}],
            "model": "openai/gpt-4.1-mini",
            "usage": {"prompt_tokens": 50, "completion_tokens": 30},
        })
    )

    # Mock UAZAPI send
    respx.post("http://localhost:8080/message/sendText/session-webhook-test").mock(
        return_value=Response(200, json={"status": "sent"})
    )

    # Send webhook
    payload = {
        "data": {
            "instance": "session-webhook-test",
            "key": {
                "id": "msg-test-001",
                "remoteJid": "5511999990000@s.whatsapp.net",
            },
            "pushName": "Cliente Teste",
            "message": {
                "conversation": "Quero trocar o piso da minha sala",
            },
        }
    }

    response = await client.post("/v1/webhooks/uazapi", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processed"
    assert data["intent"] == "visual_edit"
    assert data["state"] == "awaiting_base_image"


@pytest.mark.anyio
async def test_webhook_unknown_session(client):
    payload = {
        "data": {
            "instance": "session-unknown",
            "key": {"id": "msg-001", "remoteJid": "5511999990000@s.whatsapp.net"},
            "pushName": "Ninguem",
            "message": {"conversation": "Oi"},
        }
    }
    response = await client.post("/v1/webhooks/uazapi", json=payload)
    data = response.json()
    assert data["status"] == "ignored"
    assert data["reason"] == "channel_not_found"


@pytest.mark.anyio
async def test_webhook_unknown_provider(client):
    response = await client.post("/v1/webhooks/telegram", json={})
    assert response.status_code == 400
```

- [ ] **Step 2: Rodar todos os testes**

Run: `cd services/api-server && python -m pytest -v`
Expected: todos os testes PASSED

- [ ] **Step 3: Commit**

```bash
git add services/api-server/tests/test_webhook_flow.py
git commit -m "test: end-to-end webhook flow integration tests"
```

---

## Task 11: Rodar suite completa e commit final

- [ ] **Step 1: Rodar todos os testes**

Run: `cd services/api-server && python -m pytest -v --tb=short`
Expected: todos os testes PASSED

- [ ] **Step 2: Verificar que a API inicia**

Run: `cd services/api-server && timeout 5 uvicorn app.main:app --port 8000 2>&1 || true`
Expected: log de startup sem erros

- [ ] **Step 3: Commit final se necessario**

Se houver ajustes pendentes:
```bash
git add -A
git commit -m "fix: adjustments from full test suite run"
```

---

## Self-Review Checklist

**Spec coverage:**
- [ ] Gateway normalizer (UAZAPI + WUZAPI)
- [ ] Tenant resolution por session_id
- [ ] Upsert contact
- [ ] Persistencia de mensagem e assets
- [ ] Classificacao de intencao via OpenRouter
- [ ] State machine com todas as transicoes
- [ ] Channel sender (UAZAPI text + image)
- [ ] Billing tracker (LLM tokens + messages)
- [ ] Conversation handler orquestrando o fluxo
- [ ] Webhook endpoint
- [ ] Teste end-to-end

**Placeholder scan:**
- conversation_handler.py: job creation logado mas nao cria job real (precisa de base_asset_id do MinIO — Fase 3)
- sender.py: WUZAPI nao implementado (so UAZAPI)
- Assets: storage_key salvo mas upload MinIO nao feito (Fase 3)
