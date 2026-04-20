import asyncio
from typing import Any

import httpx

from app.config import settings
from app.grounded_sam_provider import segment_with_grounded_sam
from app.local_provider import segment_with_local_model
from app.schemas import SegmentationRequest, SegmentationResponse


class SegmentationError(RuntimeError):
    pass


def _target_prompt(request: SegmentationRequest) -> str:
    if request.target in {"painted_wall", "wall"}:
        return (
            "precise mask for only the painted/plastered wall surface that can receive paint; "
            "exclude tiles, ceramic wall covering, stone, doors, windows, glass, floor, ceiling, baseboards, "
            "furniture, appliances, sinks, fixtures, people, objects and shadows cast by objects"
        )

    if request.target == "floor":
        return "precise mask for only the visible floor surface; exclude walls, ceiling, furniture, people and loose objects"

    if request.target == "ceiling":
        return "precise mask for only the visible ceiling; exclude walls, doors, windows, furniture and lighting fixtures"

    return "precise mask for foreground objects, furniture, appliances, people and loose objects"


def _as_data_url(value: str) -> str | None:
    if value.startswith("data:image/"):
        return value
    return None


def _find_mask_url(value: Any) -> str | None:
    if isinstance(value, str):
        if value.startswith("data:image/") or value.startswith("http://") or value.startswith("https://"):
            return value
        return None

    if isinstance(value, dict):
        for key in ("mask", "mask_url", "maskUrl", "output", "image", "url"):
            found = _find_mask_url(value.get(key))
            if found:
                return found

        for nested in value.values():
            found = _find_mask_url(nested)
            if found:
                return found

    if isinstance(value, list):
        for item in value:
            found = _find_mask_url(item)
            if found:
                return found

    return None


async def _download_as_data_url(url: str) -> str:
    if url.startswith("data:image/"):
        return url

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "image/png").split(";")[0]
        import base64

        return f"data:{content_type};base64,{base64.b64encode(response.content).decode('ascii')}"


async def segment_with_replicate(request: SegmentationRequest) -> SegmentationResponse:
    if not settings.replicate_api_token:
        raise SegmentationError("REPLICATE_API_TOKEN nao configurado.")

    target_prompt = _target_prompt(request)
    user_prompt = request.prompt.strip()
    prompt = f"{target_prompt}. User request: {user_prompt}" if user_prompt else target_prompt
    if request.exclude:
        prompt = f"{prompt}. Exclude: {', '.join(request.exclude)}"

    payload = {
        "input": {
            "image": request.image,
            "prompt": prompt,
            "box_threshold": 0.25,
            "text_threshold": 0.25,
        }
    }

    headers = {
        "Authorization": f"Bearer {settings.replicate_api_token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        start = await client.post(
            f"https://api.replicate.com/v1/models/{settings.replicate_model}/predictions",
            headers=headers,
            json=payload,
        )
        start.raise_for_status()
        prediction = start.json()
        prediction_url = prediction.get("urls", {}).get("get")

        if not prediction_url:
            raise SegmentationError("Replicate nao retornou URL de prediction.")

        for _ in range(90):
            await asyncio.sleep(1)
            poll = await client.get(prediction_url, headers=headers)
            poll.raise_for_status()
            prediction = poll.json()
            status = prediction.get("status")

            if status == "succeeded":
                mask_url = _find_mask_url(prediction.get("output"))
                if not mask_url:
                    raise SegmentationError("Modelo Replicate nao retornou uma mascara de imagem reconhecivel.")

                return SegmentationResponse(
                    ok=True,
                    provider="replicate",
                    model=settings.replicate_model,
                    target=request.target,
                    mask=await _download_as_data_url(mask_url),
                    confidence=None,
                    raw=prediction.get("output"),
                )

            if status in {"failed", "canceled"}:
                raise SegmentationError(str(prediction.get("error") or f"Replicate finalizou com status {status}."))

        raise SegmentationError("Timeout aguardando segmentacao no Replicate.")


async def segment(request: SegmentationRequest) -> SegmentationResponse:
    provider = settings.provider.strip().lower()

    if provider == "grounded_sam":
        try:
            return await segment_with_grounded_sam(request)
        except Exception as error:
            raise SegmentationError(f"Grounded-SAM falhou: {error}") from error

    if provider == "local":
        try:
            return await segment_with_local_model(request)
        except Exception as error:
            raise SegmentationError(f"Segmentacao local falhou: {error}") from error

    if provider == "replicate":
        return await segment_with_replicate(request)

    existing_mask = _as_data_url(request.image) if request.target == "objects" else None
    if existing_mask:
        return SegmentationResponse(
            ok=True,
            provider="disabled",
            target=request.target,
            mask=existing_mask,
            message="Provider desabilitado; ecoando imagem apenas para testes explicitos.",
        )

    raise SegmentationError(
        "Servico de segmentacao sem provider ativo. Configure SEGMENTATION_PROVIDER=grounded_sam ou "
        "SEGMENTATION_PROVIDER=local para inferencia local, ou SEGMENTATION_PROVIDER=replicate com REPLICATE_API_TOKEN."
    )
