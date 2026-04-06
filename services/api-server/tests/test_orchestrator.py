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
