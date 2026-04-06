import base64
import json
import logging

import httpx

from worker.config import settings

logger = logging.getLogger(__name__)


async def generate_composition(
    base_image_bytes: bytes,
    reference_image_bytes: bytes | None,
    mode: str,
    input_payload: dict | None = None,
) -> bytes:
    """Call OpenRouter Nano Banana Pro to generate a visual composition.

    Returns the generated image as bytes.
    """
    base_b64 = base64.b64encode(base_image_bytes).decode()

    content_parts = []

    # Base image
    content_parts.append({
        "type": "image_url",
        "image_url": {"url": f"data:image/jpeg;base64,{base_b64}"},
    })

    # Reference image (catalog item)
    if reference_image_bytes:
        ref_b64 = base64.b64encode(reference_image_bytes).decode()
        content_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{ref_b64}"},
        })

    # Build prompt based on mode
    prompt = _build_prompt(mode, input_payload)
    content_parts.append({"type": "text", "text": prompt})

    body = {
        "model": settings.openrouter_image_model,
        "messages": [
            {"role": "user", "content": content_parts},
        ],
        "modalities": ["image", "text"],
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            json=body,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    # Extract image from response
    choice = data["choices"][0]["message"]
    content = choice.get("content", [])

    if isinstance(content, list):
        for part in content:
            if isinstance(part, dict) and part.get("type") == "image_url":
                img_url = part["image_url"]["url"]
                if img_url.startswith("data:"):
                    # Extract base64 data
                    _, b64_data = img_url.split(",", 1)
                    return base64.b64decode(b64_data)

    raise ValueError("No image found in OpenRouter response")


def _build_prompt(mode: str, input_payload: dict | None) -> str:
    payload = input_payload or {}

    if mode == "interior":
        item_name = payload.get("item_name", "o produto selecionado")
        item_desc = payload.get("item_description", "")
        tags = payload.get("tags", {})

        parts = [
            f"Aplique {item_name} neste ambiente.",
            f"Descricao: {item_desc}." if item_desc else "",
            f"Cor: {tags.get('cor', '')}." if tags.get("cor") else "",
            f"Material: {tags.get('material', '')}." if tags.get("material") else "",
            f"Estilo: {tags.get('estilo', '')}." if tags.get("estilo") else "",
            "Mantenha a perspectiva e iluminacao originais do ambiente.",
            "Gere uma imagem fotorrealista com o produto aplicado.",
        ]
        return " ".join(p for p in parts if p)

    elif mode == "product":
        item_name = payload.get("item_name", "o produto")
        return (
            f"Insira {item_name} nesta cena de forma natural e harmonizada. "
            "Mantenha a iluminacao e perspectiva coerentes. "
            "Gere uma imagem fotorrealista."
        )

    return "Gere uma composicao visual combinando estas imagens de forma fotorrealista."
