import base64

import pytest
import respx
from httpx import Response

from worker.processor import generate_composition, _build_prompt


@pytest.fixture
def fake_image() -> bytes:
    return b"\xff\xd8\xff\xe0fake-jpeg-data"


@pytest.fixture
def fake_response_image() -> str:
    img_bytes = b"\xff\xd8\xff\xe0generated-image"
    return base64.b64encode(img_bytes).decode()


@pytest.mark.anyio
@respx.mock
async def test_generate_composition(fake_image, fake_response_image):
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{
                "message": {
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{fake_response_image}"}},
                        {"type": "text", "text": "Aqui esta a composicao."},
                    ],
                },
            }],
            "model": "google/gemini-3-pro-image-preview",
            "usage": {"prompt_tokens": 100, "completion_tokens": 200},
        })
    )

    result = await generate_composition(fake_image, None, "interior", {"item_name": "piso ceramico"})
    assert result == base64.b64decode(fake_response_image)


@pytest.mark.anyio
@respx.mock
async def test_generate_composition_no_image_raises(fake_image):
    respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
        return_value=Response(200, json={
            "choices": [{
                "message": {"content": "Desculpe, nao consegui gerar a imagem."},
            }],
        })
    )

    with pytest.raises(ValueError, match="No image found"):
        await generate_composition(fake_image, None, "interior")


def test_build_prompt_interior():
    prompt = _build_prompt("interior", {"item_name": "piso ceramico", "tags": {"cor": "bege"}})
    assert "piso ceramico" in prompt
    assert "bege" in prompt


def test_build_prompt_product():
    prompt = _build_prompt("product", {"item_name": "copo personalizado"})
    assert "copo personalizado" in prompt
