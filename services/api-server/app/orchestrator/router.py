import logging

from fastapi import APIRouter, HTTPException

from app.core import repository as repo
from app.channel import sender
from app.billing import tracker
from app.storage.client import presigned_url

logger = logging.getLogger(__name__)

router = APIRouter(tags=["internal"])


@router.post("/internal/job-completed/{job_id}")
async def job_completed(job_id: str):
    # 1. Get job
    job = await repo.get_composition_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    tenant_id = str(job["tenant_id"])
    conversation_id = str(job["conversation_id"])
    job_status = job["status"]

    # 2. Get conversation to find channel and contact
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
        # 3. Get render and generate presigned URL
        render = await repo.get_render_by_job(job_id)
        if not render:
            raise HTTPException(status_code=404, detail="Render not found")

        asset = await repo.get_asset(str(render["asset_id"]))
        if not asset:
            raise HTTPException(status_code=404, detail="Render asset not found")

        image_url = presigned_url(asset["storage_key"], expires_seconds=7200)

        # 4. Send image on WhatsApp
        await sender.send_image(
            provider, session_id, remote_jid, image_url,
            caption="Aqui esta o resultado da composicao!",
        )

        # 5. Persist outbound message
        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            f"[Composicao enviada: {asset['storage_key']}]",
            "composition_result", None,
        )

        # 6. Update conversation state
        await repo.update_conversation_state(conversation_id, "completed")

        # 7. Track billing
        await tracker.track_message_sent(tenant_id, conversation_id, provider)

        return {"status": "sent", "job_id": job_id}

    elif job_status == "failed":
        error_msg = job.get("error_message", "Erro desconhecido")

        # Send apology message
        await sender.send_text(
            provider, session_id, remote_jid,
            "Desculpe, houve um problema ao gerar a composicao. Pode tentar novamente?",
        )

        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant",
            f"Composicao falhou: {error_msg}", "text", None,
        )

        await repo.update_conversation_state(conversation_id, "completed")

        return {"status": "failure_notified", "job_id": job_id}

    return {"status": "ignored", "job_id": job_id, "reason": f"job_status={job_status}"}
