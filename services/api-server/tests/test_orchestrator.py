import json
import pytest
import respx
from httpx import Response

from app.orchestrator.openrouter_client import chat_completion
from app.orchestrator.intent import classify_intent


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
