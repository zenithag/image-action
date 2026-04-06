import pytest
import respx
from httpx import Response


@pytest.fixture
async def seeded_conversation(client):
    # Tenant
    t = await client.post("/v1/tenants", json={
        "name": "Takeover Corp", "slug": "takeover-corp", "plan_code": "starter",
    })
    tenant = t.json()
    tid = tenant["id"]

    # Channel
    ch = await client.post(f"/v1/tenants/{tid}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi",
        "external_session_id": "session-takeover",
    })
    channel = ch.json()

    from app.db import get_conn
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE tenant_channels SET status = 'connected' WHERE id = %s",
            (channel["id"],),
        )

    # Contact
    ct = await client.post("/v1/contacts", json={
        "tenant_id": tid, "external_contact_id": "5511888880000@s.whatsapp.net",
        "display_name": "Cliente Takeover",
    })
    contact = ct.json()

    # Conversation
    cv = await client.post("/v1/conversations", json={
        "tenant_id": tid, "channel_id": channel["id"], "contact_id": contact["id"],
    })
    conversation = cv.json()

    return {"tenant": tenant, "channel": channel, "contact": contact, "conversation": conversation}


@pytest.mark.anyio
async def test_takeover_conversation(client, seeded_conversation):
    cid = seeded_conversation["conversation"]["id"]

    resp = await client.post(f"/v1/conversations/{cid}/takeover")
    assert resp.status_code == 200
    assert resp.json()["handled_by"] == "operator"


@pytest.mark.anyio
async def test_release_conversation(client, seeded_conversation):
    cid = seeded_conversation["conversation"]["id"]

    # First takeover
    await client.post(f"/v1/conversations/{cid}/takeover")

    # Then release
    resp = await client.post(f"/v1/conversations/{cid}/release")
    assert resp.status_code == 200
    assert resp.json()["handled_by"] == "ai"


@pytest.mark.anyio
@respx.mock
async def test_operator_send_message(client, seeded_conversation):
    cid = seeded_conversation["conversation"]["id"]

    respx.post("http://localhost:8080/message/sendText/session-takeover").mock(
        return_value=Response(200, json={"status": "sent"})
    )

    resp = await client.post(f"/v1/conversations/{cid}/messages", json={"text": "Ola, sou o operador!"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "sent"


@pytest.mark.anyio
async def test_takeover_not_found(client):
    resp = await client.post("/v1/conversations/00000000-0000-0000-0000-000000000000/takeover")
    assert resp.status_code == 404
