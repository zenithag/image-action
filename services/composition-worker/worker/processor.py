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

    content_parts = [{
        "type": "text",
        "text": (
            "ORDEM DAS IMAGENS: IMAGEM 1 = foto base/cena final enviada pelo cliente. "
            "Preserve camera, angulo, perspectiva, enquadramento, arquitetura, layout, fundo e composicao espacial da IMAGEM 1. "
            "Nao mova, gire, recorte, recentralize ou reinterprete a foto base. "
            "IMAGEM 2 = referencia visual de produto/material, quando existir. "
            "Use a referencia somente para material, textura, cor, padrao ou produto; nunca use a referencia como cena, fundo ou novo ambiente. "
            "Adapte a referencia para caber na IMAGEM 1; nunca adapte a IMAGEM 1 para combinar com a referencia."
        ),
    }]

    # Base image
    content_parts.append({"type": "text", "text": "IMAGEM 1 - FOTO BASE/CENA FINAL DO CLIENTE. Preserve esta cena."})
    content_parts.append({
        "type": "image_url",
        "image_url": {"url": f"data:image/jpeg;base64,{base_b64}"},
    })

    # Reference image (catalog item)
    if reference_image_bytes:
        ref_b64 = base64.b64encode(reference_image_bytes).decode()
        content_parts.append({"type": "text", "text": "IMAGEM 2 - REFERENCIA VISUAL. Nao use como cena, fundo ou novo ambiente."})
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
            f"Edite a IMAGEM 1, mantendo a mesma cena, e aplique {item_name} neste ambiente.",
            f"Descricao: {item_desc}." if item_desc else "",
            f"Cor: {tags.get('cor', '')}." if tags.get("cor") else "",
            f"Material: {tags.get('material', '')}." if tags.get("material") else "",
            f"Estilo: {tags.get('estilo', '')}." if tags.get("estilo") else "",
            "Mantenha enquadramento, angulo, perspectiva, camera, arquitetura, layout, janelas, portas, iluminacao e sombras originais da IMAGEM 1.",
            "A imagem final deve ser fiel a foto base; apenas o produto/material/referencia aplicada pode mudar.",
            "Nao crie uma nova casa, fachada, sala, parede ou ambiente parecido; altere somente o item/superficie solicitado.",
            "Gere uma imagem fotorrealista com o produto aplicado.",
        ]
        return " ".join(p for p in parts if p)

    elif mode == "product":
        item_name = payload.get("item_name", "o produto")
        return (
            f"Insira {item_name} na IMAGEM 1 de forma natural e harmonizada. "
            "Mantenha a mesma cena, camera, angulo, enquadramento, iluminacao e perspectiva da IMAGEM 1. "
            "Adapte o produto para a foto base sem mover ou reinterpretar a foto base. "
            "Nao gere uma nova cena. "
            "Gere uma imagem fotorrealista."
        )

    return "Gere uma composicao visual editando a IMAGEM 1 e preservando cena, camera, angulo, enquadramento e perspectiva originais; use as demais imagens apenas como referencia visual a ser aplicada na foto base."
