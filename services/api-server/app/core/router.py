from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.middleware import get_current_user, require_tenant_id
from app.limiter import limiter
from app.auth.schemas import AuthUser
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
@limiter.limit("30/minute")
async def create_tenant(
    request: Request,
    body: TenantCreate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin required")
    row = await repo.create_tenant(body.name, body.slug, body.plan_code)
    return _str_keys(row)


@router.get("/tenants")
@limiter.limit("100/minute")
async def list_tenants(
    request: Request,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    if not user.is_superadmin:
        raise HTTPException(status_code=403, detail="Superadmin required")
    rows = await repo.list_tenants()
    return [_str_keys(r) for r in rows]


@router.get("/tenants/{tenant_id}")
@limiter.limit("100/minute")
async def get_tenant(
    request: Request,
    tenant_id: str,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    if not user.is_superadmin and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    row = await repo.get_tenant(tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _str_keys(row)


# ── Tenant Domains ──────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/domains", status_code=201)
async def create_tenant_domain(
    tenant_id: str,
    body: TenantDomainCreate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    if not user.is_superadmin and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    row = await repo.create_tenant_domain(tenant_id, body.hostname, body.is_primary)
    return _str_keys(row)


# ── Tenant Channels ─────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/channels", status_code=201)
async def create_tenant_channel(
    tenant_id: str,
    body: TenantChannelCreate,
    user: Annotated[AuthUser, Depends(get_current_user)],
):
    if not user.is_superadmin and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
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
@limiter.limit("60/minute")
async def create_contact(
    request: Request,
    body: ContactCreate,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    if body.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    row = await repo.create_contact(
        body.tenant_id, body.external_contact_id, body.display_name, body.phone,
    )
    return _str_keys(row)


# ── Conversations ───────────────────────────────────────────────────

@router.post("/conversations", status_code=201)
async def create_conversation(
    body: ConversationCreate,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    if body.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    row = await repo.create_conversation(
        body.tenant_id, body.channel_id, body.contact_id,
    )
    return _str_keys(row)


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    row = await repo.get_conversation(conversation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(row.get("tenant_id")) != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return _str_keys(row)


# ── Messages ───────────────────────────────────────────────────────

@router.post("/messages", status_code=201)
@limiter.limit("120/minute")
async def create_message(
    request: Request,
    body: MessageCreate,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    if body.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
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
async def create_asset(
    body: AssetCreate,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    if body.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    row = await repo.create_asset(
        body.tenant_id,
        body.role,
        body.mime_type,
        body.storage_key,
        body.conversation_id,
        body.metadata_json,
    )
    return _str_keys(row)
