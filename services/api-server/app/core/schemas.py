from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Tenant ──────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    plan_code: str = Field(min_length=1, max_length=50)


class TenantResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    plan_code: str
    created_at: datetime


# ── Tenant Domain ───────────────────────────────────────────────────

class TenantDomainCreate(BaseModel):
    hostname: str = Field(min_length=1, max_length=255)
    is_primary: bool = False


class TenantDomainResponse(BaseModel):
    id: str
    tenant_id: str
    hostname: str
    is_primary: bool
    status: str
    verified_at: Optional[datetime] = None
    created_at: datetime


# ── Tenant Channel ──────────────────────────────────────────────────

class TenantChannelCreate(BaseModel):
    channel_type: str = Field(pattern=r"^(whatsapp|instagram)$")
    provider: str = Field(pattern=r"^(uazapi|wuzapi)$")
    external_session_id: str = Field(min_length=1)
    webhook_secret: Optional[str] = None


class TenantChannelResponse(BaseModel):
    id: str
    tenant_id: str
    channel_type: str
    provider: str
    external_session_id: str
    webhook_secret: Optional[str] = None
    status: str
    created_at: datetime


# ── Contact ─────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    tenant_id: str
    external_contact_id: str = Field(min_length=1)
    display_name: str = Field(min_length=1, max_length=200)
    phone: Optional[str] = None


class ContactResponse(BaseModel):
    id: str
    tenant_id: str
    external_contact_id: str
    display_name: str
    phone: Optional[str] = None
    created_at: datetime


# ── Conversation ────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    tenant_id: str
    channel_id: str
    contact_id: str


class ConversationResponse(BaseModel):
    id: str
    tenant_id: str
    channel_id: str
    contact_id: str
    status: str
    state: str
    handled_by: str
    operator_id: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime


# ── Message ─────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    tenant_id: str
    conversation_id: str
    direction: str = Field(pattern=r"^(inbound|outbound)$")
    role: str = Field(pattern=r"^(customer|assistant|operator|system)$")
    content: str = Field(min_length=1)
    content_type: str = "text"
    provider_message_id: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: str
    direction: str
    role: str
    content: str
    content_type: str
    provider_message_id: Optional[str] = None
    created_at: datetime


# ── Asset ───────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    tenant_id: str
    conversation_id: Optional[str] = None
    role: str = Field(
        pattern=r"^(reference|base_image|overlay|mask|render|attachment|catalog)$"
    )
    mime_type: str = Field(min_length=1)
    storage_key: str = Field(min_length=1)
    metadata_json: Optional[dict] = None


class AssetResponse(BaseModel):
    id: str
    tenant_id: str
    conversation_id: Optional[str] = None
    role: str
    mime_type: str
    storage_key: str
    metadata_json: Optional[dict] = None
    created_at: datetime
