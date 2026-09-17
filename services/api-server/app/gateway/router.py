import logging
from typing import Annotated

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

from app.gateway.normalizer import normalize
from app.limiter import limiter
from app.orchestrator.conversation_handler import handle_inbound

logger = logging.getLogger(__name__)

router = APIRouter(tags=["gateway"])

MAX_PAYLOAD_SIZE = 1_000_000


class WebhookPayloadBasic(BaseModel):
    pass


@router.post("/webhooks/{provider}")
@limiter.limit("300/minute")
async def receive_webhook(request: Request, provider: str):
    if provider not in ("uazapi", "wuzapi"):
        return Response(status_code=400, content="Unknown provider")

    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_PAYLOAD_SIZE:
        logger.warning("Webhook payload too large from %s: %s bytes", provider, content_length)
        return Response(status_code=413, content="Payload too large")

    try:
        raw_body = await request.body()
        if len(raw_body) > MAX_PAYLOAD_SIZE:
            return Response(status_code=413, content="Payload too large")
        import json
        payload = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        logger.error("Invalid JSON in webhook from %s: %s", provider, e)
        return Response(status_code=400, content="Invalid JSON payload")

    if not isinstance(payload, dict):
        return Response(status_code=400, content="Payload must be a JSON object")

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
