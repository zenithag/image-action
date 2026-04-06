from pydantic import BaseModel


class NormalizedInbound(BaseModel):
    provider: str
    external_session_id: str
    external_message_id: str
    external_contact_id: str
    contact_name: str
    phone: str | None = None
    text: str | None = None
    media: list[dict] = []
    raw_payload: dict = {}
