from app.orchestrator.state_machine import get_transition, determine_event


def test_idle_visual_edit():
    t = get_transition("idle", "visual_edit")
    assert t is not None
    assert t.next_state == "awaiting_base_image"
    assert t.action == "ask_for_base_image"


def test_idle_smalltalk():
    t = get_transition("idle", "smalltalk")
    assert t is not None
    assert t.next_state == "idle"
    assert t.action == "reply_in_chat"


def test_idle_handoff():
    t = get_transition("idle", "human_handoff")
    assert t is not None
    assert t.action == "handoff_to_operator"


def test_awaiting_base_image_with_image():
    t = get_transition("awaiting_base_image", "image_received")
    assert t is not None
    assert t.next_state == "collecting_preferences"


def test_awaiting_base_image_without_image():
    t = get_transition("awaiting_base_image", "text_received")
    assert t is not None
    assert t.next_state == "awaiting_base_image"


def test_collecting_preferences_done():
    t = get_transition("collecting_preferences", "preferences_collected")
    assert t is not None
    assert t.next_state == "showing_options"


def test_awaiting_selection_made():
    t = get_transition("awaiting_selection", "selection_made")
    assert t is not None
    assert t.next_state == "composing"


def test_composing_job_completed():
    t = get_transition("composing", "job_completed")
    assert t is not None
    assert t.next_state == "completed"


def test_completed_new_request():
    t = get_transition("completed", "new_request")
    assert t is not None
    assert t.next_state == "idle"


def test_determine_event_idle():
    event = determine_event("idle", {"intent": "visual_edit"}, False)
    assert event == "visual_edit"


def test_determine_event_awaiting_image_with_image():
    event = determine_event("awaiting_base_image", {}, True)
    assert event == "image_received"


def test_determine_event_awaiting_image_without_image():
    event = determine_event("awaiting_base_image", {}, False)
    assert event == "text_received"


def test_determine_event_collecting_with_tags():
    event = determine_event("collecting_preferences", {"extracted_tags": {"cor": "claro"}}, False)
    assert event == "preferences_collected"


def test_determine_event_collecting_without_tags():
    event = determine_event("collecting_preferences", {"extracted_tags": {}}, False)
    assert event == "text_received"
