import logging

from app.core import repository as repo

logger = logging.getLogger(__name__)


async def track_llm_usage(
    tenant_id: str,
    conversation_id: str,
    usage: dict,
    model: str = "openrouter",
) -> None:
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = prompt_tokens + completion_tokens

    if total_tokens == 0:
        return

    await repo.create_usage_event(
        tenant_id=tenant_id,
        kind="llm_tokens",
        provider=model,
        reference_id=conversation_id,
        quantity=float(total_tokens),
        unit_cost=0.0,
        total_cost=0.0,
        metadata_json={
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
        },
    )
    logger.info("Tracked %d tokens for tenant %s", total_tokens, tenant_id)


async def track_message_sent(tenant_id: str, conversation_id: str, provider: str) -> None:
    await repo.create_usage_event(
        tenant_id=tenant_id,
        kind="message_sent",
        provider=provider,
        reference_id=conversation_id,
        quantity=1.0,
        unit_cost=0.0,
        total_cost=0.0,
    )
