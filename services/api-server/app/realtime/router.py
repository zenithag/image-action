import logging
from typing import Annotated

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException

from app.auth.middleware import require_tenant_id
from app.auth.schemas import AuthUser
from app.core import repository as repo
from app.channel import sender
from app.billing import tracker

logger = logging.getLogger(__name__)

router = APIRouter(tags=["realtime"])


@router.post("/conversations/{conversation_id}/takeover")
async def takeover_conversation(
    conversation_id: str,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(conversation.get("tenant_id")) != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await repo.update_conversation_handled_by(conversation_id, "operator")

    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import ConversationUpdatedEvent

        tenant_id = str(conversation["tenant_id"])
        await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
            conversation_id=conversation_id,
            state=conversation["state"],
            handled_by="operator",
        ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit takeover event: %s", e)

    return {"status": "takeover", "conversation_id": conversation_id, "handled_by": "operator"}


@router.post("/conversations/{conversation_id}/release")
async def release_conversation(
    conversation_id: str,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(conversation.get("tenant_id")) != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await repo.update_conversation_handled_by(conversation_id, "ai")

    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import ConversationUpdatedEvent

        tenant_id = str(conversation["tenant_id"])
        await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
            conversation_id=conversation_id,
            state=conversation["state"],
            handled_by="ai",
        ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit release event: %s", e)

    return {"status": "released", "conversation_id": conversation_id, "handled_by": "ai"}


class OperatorMessageCreate(BaseModel):
    text: str


@router.post("/conversations/{conversation_id}/messages")
async def operator_send_message(
    conversation_id: str,
    body: OperatorMessageCreate,
    user: Annotated[AuthUser, Depends(require_tenant_id)],
):
    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if str(conversation.get("tenant_id")) != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    tenant_id = str(conversation["tenant_id"])
    channel = await repo.get_channel_by_id(str(conversation["channel_id"]))
    contact = await repo.get_contact_by_id(str(conversation["contact_id"]))
    if not channel or not contact:
        raise HTTPException(status_code=404, detail="Channel or contact not found")

    provider = channel["provider"]
    session_id = channel["external_session_id"]
    remote_jid = contact["external_contact_id"]

    await sender.send_text(provider, session_id, remote_jid, body.text)

    await repo.create_message(
        tenant_id, conversation_id, "outbound", "operator", body.text, "text", None,
    )

    await tracker.track_message_sent(tenant_id, conversation_id, provider)

    try:
        from app.realtime.manager import emit_to_tenant
        from app.realtime.events import NewMessageEvent

        await emit_to_tenant(tenant_id, "new_message", NewMessageEvent(
            conversation_id=conversation_id,
            message={"direction": "outbound", "content": body.text, "content_type": "text", "role": "operator"},
        ).to_dict())
    except Exception as e:
        logger.warning("Failed to emit operator message event: %s", e)

    return {"status": "sent", "conversation_id": conversation_id}
