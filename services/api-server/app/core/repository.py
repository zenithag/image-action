import json
from typing import Optional

from app.db import get_conn


# ── Tenant ──────────────────────────────────────────────────────────

async def create_tenant(name: str, slug: str, plan_code: str) -> dict:
    async with get_conn() as conn:
        row = await conn.execute(
            "INSERT INTO tenants (name, slug, plan_code) VALUES (%s, %s, %s) RETURNING *",
            (name, slug, plan_code),
        )
        return await row.fetchone()


async def list_tenants() -> list[dict]:
    async with get_conn() as conn:
        cur = await conn.execute("SELECT * FROM tenants ORDER BY created_at DESC")
        return await cur.fetchall()


async def get_tenant(tenant_id: str) -> Optional[dict]:
    async with get_conn() as conn:
        cur = await conn.execute("SELECT * FROM tenants WHERE id = %s", (tenant_id,))
        return await cur.fetchone()


# ── Tenant Domain ───────────────────────────────────────────────────

async def create_tenant_domain(tenant_id: str, hostname: str, is_primary: bool) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            "INSERT INTO tenant_domains (tenant_id, hostname, is_primary) VALUES (%s, %s, %s) RETURNING *",
            (tenant_id, hostname, is_primary),
        )
        return await cur.fetchone()


# ── Tenant Channel ──────────────────────────────────────────────────

async def create_tenant_channel(
    tenant_id: str,
    channel_type: str,
    provider: str,
    external_session_id: str,
    webhook_secret: Optional[str] = None,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO tenant_channels
               (tenant_id, channel_type, provider, external_session_id, webhook_secret)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (tenant_id, channel_type, provider, external_session_id, webhook_secret),
        )
        return await cur.fetchone()


# ── Contact ─────────────────────────────────────────────────────────

async def create_contact(
    tenant_id: str,
    external_contact_id: str,
    display_name: str,
    phone: Optional[str] = None,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO contacts (tenant_id, external_contact_id, display_name, phone)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (tenant_id, external_contact_id, display_name, phone),
        )
        return await cur.fetchone()


async def get_contact(contact_id: str) -> Optional[dict]:
    async with get_conn() as conn:
        cur = await conn.execute("SELECT * FROM contacts WHERE id = %s", (contact_id,))
        return await cur.fetchone()


# ── Conversation ────────────────────────────────────────────────────

async def create_conversation(
    tenant_id: str, channel_id: str, contact_id: str,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO conversations (tenant_id, channel_id, contact_id)
               VALUES (%s, %s, %s) RETURNING *""",
            (tenant_id, channel_id, contact_id),
        )
        return await cur.fetchone()


async def get_conversation(conversation_id: str) -> Optional[dict]:
    async with get_conn() as conn:
        cur = await conn.execute(
            "SELECT * FROM conversations WHERE id = %s", (conversation_id,),
        )
        return await cur.fetchone()


# ── Message ─────────────────────────────────────────────────────────

async def create_message(
    tenant_id: str,
    conversation_id: str,
    direction: str,
    role: str,
    content: str,
    content_type: str = "text",
    provider_message_id: Optional[str] = None,
) -> dict:
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO messages
               (tenant_id, conversation_id, direction, role, content, content_type, provider_message_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *""",
            (tenant_id, conversation_id, direction, role, content, content_type, provider_message_id),
        )
        return await cur.fetchone()


# ── Asset ───────────────────────────────────────────────────────────

async def create_asset(
    tenant_id: str,
    role: str,
    mime_type: str,
    storage_key: str,
    conversation_id: Optional[str] = None,
    metadata_json: Optional[dict] = None,
) -> dict:
    meta = json.dumps(metadata_json) if metadata_json else "{}"
    async with get_conn() as conn:
        cur = await conn.execute(
            """INSERT INTO assets
               (tenant_id, conversation_id, role, mime_type, storage_key, metadata_json)
               VALUES (%s, %s, %s, %s, %s, %s::jsonb) RETURNING *""",
            (tenant_id, conversation_id, role, mime_type, storage_key, meta),
        )
        return await cur.fetchone()


async def get_asset(asset_id: str) -> Optional[dict]:
    async with get_conn() as conn:
        cur = await conn.execute("SELECT * FROM assets WHERE id = %s", (asset_id,))
        return await cur.fetchone()


# ── Gateway / Orchestrator / Billing ───────────────────────────────

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
