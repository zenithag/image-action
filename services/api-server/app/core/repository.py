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
