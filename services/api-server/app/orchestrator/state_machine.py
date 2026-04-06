from dataclasses import dataclass


@dataclass
class Transition:
    next_state: str
    action: str


TRANSITIONS: dict[str, dict[str, Transition]] = {
    "idle": {
        "visual_edit": Transition(next_state="awaiting_base_image", action="ask_for_base_image"),
        "commercial_question": Transition(next_state="idle", action="reply_in_chat"),
        "smalltalk": Transition(next_state="idle", action="reply_in_chat"),
        "human_handoff": Transition(next_state="idle", action="handoff_to_operator"),
    },
    "awaiting_base_image": {
        "image_received": Transition(next_state="collecting_preferences", action="ask_preferences"),
        "text_received": Transition(next_state="awaiting_base_image", action="ask_for_base_image"),
    },
    "collecting_preferences": {
        "preferences_collected": Transition(next_state="showing_options", action="show_catalog_options"),
        "text_received": Transition(next_state="collecting_preferences", action="ask_preferences"),
    },
    "showing_options": {
        "options_sent": Transition(next_state="awaiting_selection", action="wait_selection"),
    },
    "awaiting_selection": {
        "selection_made": Transition(next_state="composing", action="create_composition_job"),
        "text_received": Transition(next_state="awaiting_selection", action="ask_selection"),
    },
    "composing": {
        "job_completed": Transition(next_state="completed", action="send_result"),
        "job_failed": Transition(next_state="completed", action="notify_failure"),
    },
    "completed": {
        "new_request": Transition(next_state="idle", action="reset"),
        "more_options": Transition(next_state="showing_options", action="show_catalog_options"),
    },
}


def get_transition(current_state: str, event: str) -> Transition | None:
    state_transitions = TRANSITIONS.get(current_state, {})
    return state_transitions.get(event)


def determine_event(current_state: str, intent: dict, has_image: bool) -> str:
    if current_state == "idle":
        return intent.get("intent", "smalltalk")

    if current_state == "awaiting_base_image":
        return "image_received" if has_image else "text_received"

    if current_state == "collecting_preferences":
        tags = intent.get("extracted_tags", {})
        if tags:
            return "preferences_collected"
        return "text_received"

    if current_state == "awaiting_selection":
        next_action = intent.get("next_action", "")
        if next_action == "create_composition_job":
            return "selection_made"
        return "text_received"

    if current_state == "completed":
        if intent.get("intent") == "visual_edit":
            return "new_request"
        if intent.get("next_action") == "show_catalog_options":
            return "more_options"
        return "new_request"

    return "text_received"
