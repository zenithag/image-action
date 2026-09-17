import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth.middleware import get_current_user, require_tenant_id
from app.auth.schemas import AuthUser
from app.core import repository as repo
from app.channel import sender
from app.billing import tracker
from app.storage.client import presigned_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["internal"])

_worker_token: str | None = None


def _get_worker_token() -> str:
    global _worker_token
    if _worker_token is None:
        from app.config import settings
        _worker_token = settings.openrouter_api_key
    return _worker_token


def _verify_worker_token(token: str | None) -> bool:
    if not token:
        return False
    expected = _get_worker_token()
    if not expected:
        return False
    import secrets
    return secrets.compare_digest(token, expected)


@router.post("/internal/job-completed/{job_id}")
async def job_completed(job_id: str, x_worker_token: str | None = None):
    if not _verify_worker_token(x_worker_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    job = await repo.get_composition_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    tenant_id = str(job["tenant_id"])
    conversation_id = str(job["conversation_id"])
    job_status = job["status"]

    conversation = await repo.get_conversation(conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    channel = await repo.get_channel_by_id(str(conversation["channel_id"]))
    contact = await repo.get_contact_by_id(str(conversation["contact_id"]))
    if not channel or not contact:
        raise HTTPException(status_code=404, detail="Channel or contact not found")

    provider = channel["provider"]
    session_id = channel["external_session_id"]
    remote_jid = contact["external_contact_id"]

    if job_status == "done":
        render = await repo.get_render_by_job(job_id)
        if not render:
            raise HTTPException(status_code=404, detail="Render not found")

        asset = await repo.get_asset(str(render["asset_id"]))
        if not asset:
            raise HTTPException(status_code=404, detail="Render asset not found")

        image_url = presigned_url(asset["storage_key"], expires_seconds=7200)

        await sender.send_image(
            provider, session_id, remote_jid, image_url,
            caption="Aqui esta o resultado da composicao!",
        )

        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            f"[Composicao enviada: {asset['storage_key']}]",
            "composition_result", None,
        )

        await repo.update_conversation_state(conversation_id, "completed")
        await tracker.track_message_sent(tenant_id, conversation_id, provider)

        try:
            from app.realtime.manager import emit_to_tenant
            from app.realtime.events import JobUpdatedEvent, ConversationUpdatedEvent

            await emit_to_tenant(tenant_id, "job_updated", JobUpdatedEvent(
                job_id=job_id, status="done", conversation_id=conversation_id,
            ).to_dict())
            await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
                conversation_id=conversation_id, state="completed", handled_by="ai",
            ).to_dict())
        except Exception as e:
            logger.warning("Failed to emit realtime events: %s", e)

        return {"status": "sent", "job_id": job_id}

    elif job_status == "failed":
        error_msg = job.get("error_message", "Erro desconhecido")

        await sender.send_text(
            provider, session_id, remote_jid,
            "Desculpe, houve um problema ao gerar a composicao. Pode tentar novamente?",
        )

        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            f"Composicao falhou: {error_msg}", "text", None,
        )

        await repo.update_conversation_state(conversation_id, "completed")

        try:
            from app.realtime.manager import emit_to_tenant
            from app.realtime.events import JobUpdatedEvent, ConversationUpdatedEvent

            await emit_to_tenant(tenant_id, "job_updated", JobUpdatedEvent(
                job_id=job_id, status="failed", conversation_id=conversation_id,
            ).to_dict())
            await emit_to_tenant(tenant_id, "conversation_updated", ConversationUpdatedEvent(
                conversation_id=conversation_id, state="completed", handled_by="ai",
            ).to_dict())
        except Exception as e:
            logger.warning("Failed to emit realtime events: %s", e)

        return {"status": "failure_notified", "job_id": job_id}

    return {"status": "ignored", "job_id": job_id, "reason": f"job_status={job_status}"}
