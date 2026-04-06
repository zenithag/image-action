from app.gateway.schemas import NormalizedInbound


def normalize_uazapi(payload: dict) -> NormalizedInbound:
    data = payload.get("data", payload)
    message = data.get("message", data)
    key = data.get("key", {})

    text = None
    media = []

    if "conversation" in message:
        text = message["conversation"]
    elif "extendedTextMessage" in message:
        text = message["extendedTextMessage"].get("text")
    elif "imageMessage" in message:
        img = message["imageMessage"]
        text = img.get("caption")
        media.append({
            "mime_type": img.get("mimetype", "image/jpeg"),
            "url": img.get("url", ""),
            "caption": img.get("caption"),
            "kind": "image",
        })

    return NormalizedInbound(
        provider="uazapi",
        external_session_id=data.get("instance", ""),
        external_message_id=key.get("id", ""),
        external_contact_id=key.get("remoteJid", ""),
        contact_name=data.get("pushName", key.get("remoteJid", "")),
        phone=key.get("remoteJid", "").split("@")[0] if "@" in key.get("remoteJid", "") else None,
        text=text,
        media=media,
        raw_payload=payload,
    )


def normalize_wuzapi(payload: dict) -> NormalizedInbound:
    event = payload.get("event", {})
    info = event.get("info", {})
    msg = event.get("message", {})

    text = msg.get("conversation") or msg.get("extendedTextMessage", {}).get("text")
    media = []

    if "imageMessage" in msg:
        img = msg["imageMessage"]
        media.append({
            "mime_type": img.get("mimetype", "image/jpeg"),
            "url": img.get("url", ""),
            "caption": img.get("caption"),
            "kind": "image",
        })

    return NormalizedInbound(
        provider="wuzapi",
        external_session_id=payload.get("instance", ""),
        external_message_id=info.get("id", ""),
        external_contact_id=info.get("remoteJid", ""),
        contact_name=info.get("pushName", info.get("remoteJid", "")),
        phone=info.get("remoteJid", "").split("@")[0] if "@" in info.get("remoteJid", "") else None,
        text=text,
        media=media,
        raw_payload=payload,
    )


def normalize(provider: str, payload: dict) -> NormalizedInbound:
    if provider == "uazapi":
        return normalize_uazapi(payload)
    elif provider == "wuzapi":
        return normalize_wuzapi(payload)
    raise ValueError(f"Unknown provider: {provider}")
