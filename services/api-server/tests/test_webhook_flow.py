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
