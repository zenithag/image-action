import pytest


async def _create_tenant(client) -> dict:
    r = await client.post("/v1/tenants", json={
        "name": "Test Corp", "slug": "test-corp", "plan_code": "starter",
    })
    return r.json()


async def _create_channel(client, tenant_id: str) -> dict:
    r = await client.post(f"/v1/tenants/{tenant_id}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi", "external_session_id": "sess-001",
    })
    return r.json()


async def _create_contact(client, tenant_id: str) -> dict:
    r = await client.post("/v1/contacts", json={
        "tenant_id": tenant_id, "external_contact_id": "5511999990001@s.whatsapp.net",
        "display_name": "Joao", "phone": "+5511999990001",
    })
    return r.json()


@pytest.mark.anyio
async def test_create_domain(client):
    tenant = await _create_tenant(client)
    r = await client.post(f"/v1/tenants/{tenant['id']}/domains", json={
        "hostname": "test.example.com", "is_primary": True,
    })
    assert r.status_code == 201
    assert r.json()["hostname"] == "test.example.com"
    assert r.json()["status"] == "pending_verification"


@pytest.mark.anyio
async def test_create_channel(client):
    tenant = await _create_tenant(client)
    r = await client.post(f"/v1/tenants/{tenant['id']}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi", "external_session_id": "sess-002",
    })
    assert r.status_code == 201
    assert r.json()["channel_type"] == "whatsapp"
    assert r.json()["status"] == "pending"


@pytest.mark.anyio
async def test_create_contact(client):
    tenant = await _create_tenant(client)
    r = await client.post("/v1/contacts", json={
        "tenant_id": tenant["id"], "external_contact_id": "5511999990002@s.whatsapp.net",
        "display_name": "Maria", "phone": "+5511999990002",
    })
    assert r.status_code == 201
    assert r.json()["display_name"] == "Maria"


@pytest.mark.anyio
async def test_create_conversation(client):
    tenant = await _create_tenant(client)
    channel = await _create_channel(client, tenant["id"])
    contact = await _create_contact(client, tenant["id"])

    r = await client.post("/v1/conversations", json={
        "tenant_id": tenant["id"], "channel_id": channel["id"], "contact_id": contact["id"],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "open"
    assert data["state"] == "idle"
    assert data["handled_by"] == "ai"


@pytest.mark.anyio
async def test_create_message(client):
    tenant = await _create_tenant(client)
    channel = await _create_channel(client, tenant["id"])
    contact = await _create_contact(client, tenant["id"])
    conv_r = await client.post("/v1/conversations", json={
        "tenant_id": tenant["id"], "channel_id": channel["id"], "contact_id": contact["id"],
    })
    conv = conv_r.json()

    r = await client.post("/v1/messages", json={
        "tenant_id": tenant["id"], "conversation_id": conv["id"],
        "direction": "inbound", "role": "customer", "content": "Oi, quero trocar o piso",
    })
    assert r.status_code == 201
    assert r.json()["content_type"] == "text"


@pytest.mark.anyio
async def test_create_asset(client):
    tenant = await _create_tenant(client)

    r = await client.post("/v1/assets", json={
        "tenant_id": tenant["id"], "role": "catalog",
        "mime_type": "image/jpeg", "storage_key": "tenants/test-corp/catalog/img.jpg",
    })
    assert r.status_code == 201
    assert r.json()["role"] == "catalog"
