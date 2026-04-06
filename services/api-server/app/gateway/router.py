import logging

from fastapi import APIRouter, Request, Response

from app.gateway.normalizer import normalize
from app.orchestrator.conversation_handler import handle_inbound

logger = logging.getLogger(__name__)

router = APIRouter(tags=["gateway"])


@router.post("/webhooks/{provider}")
async def receive_webhook(provider: str, request: Request):
    if provider not in ("uazapi", "wuzapi"):
        return Response(status_code=400, content="Unknown provider")

    payload = await request.json()
    logger.info("Webhook received from %s", provider)

    try:
        inbound = normalize(provider, payload)
    except Exception as e:
        logger.error("Failed to normalize webhook: %s", e)
        return {"status": "error", "detail": "normalization_failed"}

    if not inbound.text and not inbound.media:
        logger.info("Ignoring non-message webhook (status update, etc.)")
        return {"status": "ignored", "reason": "no_content"}

    result = await handle_inbound(inbound)
    return result
