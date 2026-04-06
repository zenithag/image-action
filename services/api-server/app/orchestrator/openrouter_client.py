import httpx

from app.config import settings


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
) -> dict:
    model = model or settings.openrouter_model
    url = "https://openrouter.ai/api/v1/chat/completions"

    body: dict = {
        "model": model,
        "messages": messages,
    }
    if response_format:
        body["response_format"] = response_format

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            json=body,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    choice = data["choices"][0]
    return {
        "content": choice["message"]["content"],
        "model": data.get("model", model),
        "usage": data.get("usage", {}),
    }
