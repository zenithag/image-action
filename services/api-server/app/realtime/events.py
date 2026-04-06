from dataclasses import dataclass, asdict


@dataclass
class NewMessageEvent:
    conversation_id: str
    message: dict

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class JobUpdatedEvent:
    job_id: str
    status: str
    conversation_id: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ConversationUpdatedEvent:
    conversation_id: str
    state: str
    handled_by: str
    operator_id: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)
