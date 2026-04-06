from fastapi import APIRouter, HTTPException

from app.core import repository as repo
from app.core.schemas import (
    AssetCreate,
    ContactCreate,
    ConversationCreate,
    MessageCreate,
    TenantChannelCreate,
    TenantCreate,
    TenantDomainCreate,
)

router = APIRouter()


def _str_keys(row: dict) -> dict:
    return {k: str(v) if hasattr(v, "hex") else v for k, v in row.items()}


# ── Health ──────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok"}


# ── Tenants ─────────────────────────────────────────────────────────

@router.post("/tenants", status_code=201)
async def create_tenant(body: TenantCreate):
    row = await repo.create_tenant(body.name, body.slug, body.plan_code)
    return _str_keys(row)


@router.get("/tenants")
async def list_tenants():
    rows = await repo.list_tenants()
    return [_str_keys(r) for r in rows]


@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str):
    row = await repo.get_tenant(tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _str_keys(row)


# ── Tenant Domains ──────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/domains", status_code=201)
async def create_tenant_domain(tenant_id: str, body: TenantDomainCreate):
    row = await repo.create_tenant_domain(tenant_id, body.hostname, body.is_primary)
    return _str_keys(row)


# ── Tenant Channels ─────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/channels", status_code=201)
async def create_tenant_channel(tenant_id: str, body: TenantChannelCreate):
    row = await repo.create_tenant_channel(
        tenant_id,
        body.channel_type,
        body.provider,
        body.external_session_id,
        body.webhook_secret,
    )
    return _str_keys(row)


# ── Contacts ────────────────────────────────────────────────────────

@router.post("/contacts", status_code=201)
async def create_contact(body: ContactCreate):
    row = await repo.create_contact(
        body.tenant_id, body.external_contact_id, body.display_name, body.phone,
    )
    return _str_keys(row)


# ── Conversations ───────────────────────────────────────────────────

@router.post("/conversations", status_code=201)
async def create_conversation(body: ConversationCreate):
    row = await repo.create_conversation(
        body.tenant_id, body.channel_id, body.contact_id,
    )
    return _str_keys(row)


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    row = await repo.get_conversation(conversation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _str_keys(row)


# ── Messages ────────────────────────────────────────────────────────

@router.post("/messages", status_code=201)
async def create_message(body: MessageCreate):
    row = await repo.create_message(
        body.tenant_id,
        body.conversation_id,
        body.direction,
        body.role,
        body.content,
        body.content_type,
        body.provider_message_id,
    )
    return _str_keys(row)


# ── Assets ──────────────────────────────────────────────────────────

@router.post("/assets", status_code=201)
async def create_asset(body: AssetCreate):
    row = await repo.create_asset(
        body.tenant_id,
        body.role,
        body.mime_type,
        body.storage_key,
        body.conversation_id,
        body.metadata_json,
    )
    return _str_keys(row)
