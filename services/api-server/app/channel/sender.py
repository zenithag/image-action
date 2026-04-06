import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def send_text(
    provider: str,
    external_session_id: str,
    remote_jid: str,
    text: str,
) -> dict | None:
    if provider == "uazapi":
        return await _send_uazapi_text(external_session_id, remote_jid, text)
    logger.warning("Send not implemented for provider: %s", provider)
    return None


async def send_image(
    provider: str,
    external_session_id: str,
    remote_jid: str,
    image_url: str,
    caption: str | None = None,
) -> dict | None:
    if provider == "uazapi":
        return await _send_uazapi_image(external_session_id, remote_jid, image_url, caption)
    logger.warning("Send not implemented for provider: %s", provider)
    return None


async def _send_uazapi_text(session_id: str, remote_jid: str, text: str) -> dict:
    url = f"{settings.uazapi_base_url}/message/sendText/{session_id}"
    body = {
        "number": remote_jid,
        "text": text,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url, json=body,
            headers={"apikey": settings.uazapi_api_key},
        )
        resp.raise_for_status()
        return resp.json()


async def _send_uazapi_image(
    session_id: str, remote_jid: str, image_url: str, caption: str | None,
) -> dict:
    url = f"{settings.uazapi_base_url}/message/sendImage/{session_id}"
    body: dict = {
        "number": remote_jid,
        "imageUrl": image_url,
    }
    if caption:
        body["caption"] = caption

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url, json=body,
            headers={"apikey": settings.uazapi_api_key},
        )
        resp.raise_for_status()
        return resp.json()
