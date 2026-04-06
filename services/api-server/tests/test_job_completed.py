import pytest
import respx
from httpx import Response
from unittest.mock import patch


@pytest.fixture
async def seeded_job(client):
    """Cria tenant, channel, contact, conversation, asset, job, e render."""
    # Tenant
    t = await client.post("/v1/tenants", json={
        "name": "Job Corp", "slug": "job-corp", "plan_code": "starter",
    })
    tenant = t.json()
    tid = tenant["id"]

    # Channel
    ch = await client.post(f"/v1/tenants/{tid}/channels", json={
        "channel_type": "whatsapp", "provider": "uazapi",
        "external_session_id": "session-job-test",
    })
    channel = ch.json()

    # Set channel to connected
    from app.db import get_conn
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE tenant_channels SET status = 'connected' WHERE id = %s",
            (channel["id"],),
        )

    # Contact
    ct = await client.post("/v1/contacts", json={
        "tenant_id": tid, "external_contact_id": "5511999990000@s.whatsapp.net",
        "display_name": "Teste",
    })
    contact = ct.json()

    # Conversation
    cv = await client.post("/v1/conversations", json={
        "tenant_id": tid, "channel_id": channel["id"], "contact_id": contact["id"],
    })
    conversation = cv.json()

    # Set conversation to composing state
    async with get_conn() as conn:
        await conn.execute(
            "UPDATE conversations SET state = 'composing' WHERE id = %s",
            (conversation["id"],),
        )

    # Base asset
    a = await client.post("/v1/assets", json={
        "tenant_id": tid, "role": "base_image", "mime_type": "image/jpeg",
        "storage_key": f"tenants/{tid}/base.jpg",
    })
    base_asset = a.json()

    # Render asset
    ra = await client.post("/v1/assets", json={
        "tenant_id": tid, "role": "render", "mime_type": "image/jpeg",
        "storage_key": f"tenants/{tid}/render.jpg",
    })
    render_asset = ra.json()

    # Composition job
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO composition_jobs
               (tenant_id, conversation_id, mode, base_asset_id, status)
               VALUES (%s, %s, 'interior', %s, 'done') RETURNING *""",
            (tid, conversation["id"], base_asset["id"]),
        )
        job = await cur.fetchone()

        # Render
        await conn.execute(
            """INSERT INTO renders (tenant_id, job_id, asset_id, version)
               VALUES (%s, %s, %s, 1)""",
            (tid, str(job["id"]), render_asset["id"]),
        )

    return {
        "tenant": tenant, "channel": channel, "contact": contact,
        "conversation": conversation, "job": job, "render_asset": render_asset,
    }


@pytest.mark.anyio
@respx.mock
@patch("app.orchestrator.router.presigned_url", return_value="https://minio.local/render.jpg?sig=abc")
async def test_job_completed_success(mock_presigned, client, seeded_job):
    job_id = str(seeded_job["job"]["id"])

    respx.post("http://localhost:8080/message/sendImage/session-job-test").mock(
        return_value=Response(200, json={"status": "sent"})
    )

    response = await client.post(f"/v1/internal/job-completed/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "sent"


@pytest.mark.anyio
async def test_job_completed_not_found(client):
    response = await client.post("/v1/internal/job-completed/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
