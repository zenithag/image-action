import pytest
from app.gateway.normalizer import normalize


def test_normalize_uazapi_text():
    payload = {
        "data": {
            "instance": "session-demo-001",
            "key": {
                "id": "msg-001",
                "remoteJid": "5511999990000@s.whatsapp.net",
            },
            "pushName": "Cliente Teste",
            "message": {
                "conversation": "Oi, quero trocar o piso",
            },
        }
    }
    result = normalize("uazapi", payload)
    assert result.provider == "uazapi"
    assert result.external_session_id == "session-demo-001"
    assert result.external_contact_id == "5511999990000@s.whatsapp.net"
    assert result.contact_name == "Cliente Teste"
    assert result.text == "Oi, quero trocar o piso"
    assert result.phone == "5511999990000"
    assert result.media == []


def test_normalize_uazapi_image():
    payload = {
        "data": {
            "instance": "session-demo-001",
            "key": {
                "id": "msg-002",
                "remoteJid": "5511999990000@s.whatsapp.net",
            },
            "pushName": "Cliente Teste",
            "message": {
                "imageMessage": {
                    "mimetype": "image/jpeg",
                    "url": "https://example.com/image.jpg",
                    "caption": "Foto da sala",
                }
            },
        }
    }
    result = normalize("uazapi", payload)
    assert result.text == "Foto da sala"
    assert len(result.media) == 1
    assert result.media[0]["kind"] == "image"
    assert result.media[0]["mime_type"] == "image/jpeg"


def test_normalize_wuzapi_text():
    payload = {
        "instance": "session-demo-002",
        "event": {
            "info": {
                "id": "msg-003",
                "remoteJid": "5511999990001@s.whatsapp.net",
                "pushName": "Maria",
            },
            "message": {
                "conversation": "Quero ver opcoes de tinta",
            },
        }
    }
    result = normalize("wuzapi", payload)
    assert result.provider == "wuzapi"
    assert result.external_session_id == "session-demo-002"
    assert result.text == "Quero ver opcoes de tinta"
    assert result.contact_name == "Maria"


def test_normalize_unknown_provider():
    with pytest.raises(ValueError, match="Unknown provider"):
        normalize("telegram", {})
