import pytest
import respx
from httpx import Response

from app.channel.sender import send_text, send_image


@pytest.mark.anyio
@respx.mock
async def test_send_text_uazapi():
    respx.post("http://localhost:8080/message/sendText/session-001").mock(
        return_value=Response(200, json={"status": "sent", "id": "msg-out-001"})
    )
    result = await send_text(
        "uazapi", "session-001", "5511999990000@s.whatsapp.net", "Ola!",
    )
    assert result["status"] == "sent"


@pytest.mark.anyio
@respx.mock
async def test_send_image_uazapi():
    respx.post("http://localhost:8080/message/sendImage/session-001").mock(
        return_value=Response(200, json={"status": "sent", "id": "msg-out-002"})
    )
    result = await send_image(
        "uazapi", "session-001", "5511999990000@s.whatsapp.net",
        "https://storage.example.com/img.jpg", "Veja o resultado!",
    )
    assert result["status"] == "sent"


@pytest.mark.anyio
async def test_send_text_unknown_provider():
    result = await send_text(
        "telegram", "session-001", "123", "Ola!",
    )
    assert result is None
