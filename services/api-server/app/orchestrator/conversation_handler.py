import logging

from app.core import repository as repo
from app.catalog import repository as catalog_repo
from app.gateway.schemas import NormalizedInbound
from app.orchestrator.intent import classify_intent
from app.orchestrator.state_machine import determine_event, get_transition
from app.channel import sender
from app.billing import tracker

logger = logging.getLogger(__name__)


async def handle_inbound(inbound: NormalizedInbound) -> dict:
    # 1. Resolve tenant by channel session
    channel = await repo.get_channel_by_session(inbound.external_session_id)
    if not channel:
        logger.warning("No channel found for session: %s", inbound.external_session_id)
        return {"status": "ignored", "reason": "channel_not_found"}

    tenant_id = str(channel["tenant_id"])
    channel_id = str(channel["id"])
    provider = channel["provider"]

    # 2. Upsert contact
    contact = await repo.upsert_contact(
        tenant_id, inbound.external_contact_id, inbound.contact_name, inbound.phone,
    )
    contact_id = str(contact["id"])

    # 3. Get or create conversation
    conversation = await repo.get_or_create_conversation(tenant_id, channel_id, contact_id)
    conversation_id = str(conversation["id"])
    current_state = conversation["state"]

    # 4. Persist inbound message
    content = inbound.text or "[media]"
    content_type = "image" if inbound.media else "text"
    await repo.create_message(
        tenant_id, conversation_id, "inbound", "customer",
        content, content_type, inbound.external_message_id,
    )

    # 5. Persist assets if media present
    has_image = False
    for media_item in inbound.media:
        storage_key = f"tenants/{tenant_id}/conversations/{conversation_id}/{inbound.external_message_id}"
        mime_type = media_item.get("mime_type", "image/jpeg")
        role = media_item.get("kind", "attachment")
        await repo.create_asset(
            tenant_id, role, mime_type, storage_key,
            conversation_id=conversation_id,
            metadata_json={"url": media_item.get("url", "")},
        )
        if media_item.get("kind") == "image":
            has_image = True

    # 6. Check handled_by
    if conversation["handled_by"] == "operator":
        logger.info("Conversation %s handled by operator, skipping AI", conversation_id)
        return {"status": "operator_handled", "conversation_id": conversation_id}

    # 7. Build message history for LLM
    messages = await repo.list_messages(conversation_id, limit=20)
    llm_history = []
    for msg in messages:
        role = "user" if msg["role"] == "customer" else "assistant"
        llm_history.append({"role": role, "content": msg["content"]})

    # 8. Classify intent
    intent_result = await classify_intent(llm_history, current_state)

    # 9. Track LLM usage
    await tracker.track_llm_usage(tenant_id, conversation_id, intent_result.get("_usage", {}))

    # 10. Determine event and transition
    event = determine_event(current_state, intent_result, has_image)
    transition = get_transition(current_state, event)

    if transition:
        await repo.update_conversation_state(conversation_id, transition.next_state)
        logger.info(
            "Conversation %s: %s -> %s (event=%s)",
            conversation_id, current_state, transition.next_state, event,
        )

    # 11. Handle special actions
    if transition and transition.action == "handoff_to_operator":
        await repo.update_conversation_handled_by(conversation_id, "operator")
        reply_text = intent_result.get("reply_text", "Vou transferir voce para um atendente.")
    elif transition and transition.action == "show_catalog_options":
        tags = intent_result.get("extracted_tags", {})
        reply_text = await _send_catalog_options(
            tenant_id, conversation_id, tags, provider,
            inbound.external_session_id, inbound.external_contact_id,
        )
    elif transition and transition.action == "create_composition_job":
        reply_text = intent_result.get("reply_text", "Estou gerando a composicao, aguarde um momento...")
        logger.info("Would create composition job for conversation %s", conversation_id)
    else:
        reply_text = intent_result.get("reply_text", "")

    # 12. Send reply
    if reply_text:
        await sender.send_text(
            provider, inbound.external_session_id,
            inbound.external_contact_id, reply_text,
        )
        await repo.create_message(
            tenant_id, conversation_id, "outbound", "assistant", reply_text, "text", None,
        )
        await tracker.track_message_sent(tenant_id, conversation_id, provider)

    return {
        "status": "processed",
        "conversation_id": conversation_id,
        "state": transition.next_state if transition else current_state,
        "intent": intent_result.get("intent"),
    }


async def _send_catalog_options(
    tenant_id: str,
    conversation_id: str,
    tags: dict,
    provider: str,
    session_id: str,
    remote_jid: str,
) -> str:
    tag_filters = {k: v for k, v in tags.items() if v} if tags else None
    items = await catalog_repo.list_items(tenant_id, tag_filters)

    if not items:
        return "Nao encontrei opcoes com essas caracteristicas. Pode descrever de outra forma?"

    items = items[:5]

    lines = ["Encontrei estas opcoes para voce:\n"]
    for i, item in enumerate(items, 1):
        name = item["name"]
        desc = item.get("description", "")
        lines.append(f"{i}. *{name}*")
        if desc:
            lines.append(f"   {desc}")

    lines.append("\nQual opcao voce prefere? Responda com o numero.")
    reply = "\n".join(lines)

    await repo.create_message(
        tenant_id, conversation_id, "outbound", "assistant", reply, "catalog_options", None,
    )
    return reply
