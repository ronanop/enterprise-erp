"""Table-driven state machine for the Sales CRM blueprint.

Governs the granular sales-process lifecycle that sits on top of the
existing (coarse) ``status`` / ``current_stage`` columns already used by the
legacy CRM lead & opportunity flows:

    LEAD:        open -> converted | lost
    OPPORTUNITY: open -> boq_pending -> boq_approval -> deal_reg ->
                 oem_pending -> quote_ready ->
                 quote_in_progress -> po_pending -> po_approval
                 (finance -> legal terms -> management) ->
                 ovf_ready -> won
    QUOTE:       draft -> internal_approval -> approved_internal ->
                 sent_to_customer -> negotiation | follow_up | accepted | lost
    OVF:         draft -> approval -> approved -> shared_scm (CRM terminal; deal_won kept for legacy rows)

Deal won is set when the customer accepts the quote; PO/OVF continue as
fulfilment. Lost is available until quote acceptance (not after). OVF has no
lost state.

This module is intentionally free of DB/session concerns: it operates on
plain (entity_type, state, action) values so it can be unit tested in
isolation and reused by every blueprint-aware service.
"""

from __future__ import annotations

from typing import Any

from modules.crm.domain.exceptions import InvalidBlueprintState, RecordLocked

LEAD = "lead"
OPPORTUNITY = "opportunity"
QUOTE = "quote"
OVF = "ovf"

# entity -> { from_state -> { action -> to_state } }
_TRANSITIONS: dict[str, dict[str, dict[str, str]]] = {
    LEAD: {
        "open": {"convert": "converted", "lost": "lost"},
        "converted": {},
        "lost": {},
    },
    OPPORTUNITY: {
        "open": {
            "attach_boq": "boq_pending",
            "attach_sow": "boq_pending",
            "send_boq_for_attachment": "boq_attachment_pending",
            "send_sow_for_attachment": "sow_attachment_pending",
            "attach_contract": "cloud_docs",
            "send_cloud_discount_approval": "cloud_discount_approval",
            "lost": "lost",
        },
        "cloud_docs": {
            "attach_contract": "cloud_docs",
            "send_cloud_discount_approval": "cloud_discount_approval",
            "lost": "lost",
        },
        "cloud_discount_approval": {
            "approve_cloud_discount": "cloud_onboarding",
            "reject_cloud_discount": "cloud_docs",
            "lost": "lost",
        },
        "map_oem_pending": {
            "attach_oem_quote": "cloud_onboarding",
            "skip_map_oem_quote": "cloud_onboarding",
            "lost": "lost",
        },
        "cloud_onboarding": {
            "mark_onboarding_done": "won",
            "lost": "lost",
        },
        "boq_pending": {
            "attach_boq": "boq_pending",
            "attach_sow": "boq_pending",
            "send_boq_approval": "boq_approval",
            "send_sow_approval": "sow_approval",
            "send_boq_for_attachment": "boq_attachment_pending",
            "send_sow_for_attachment": "sow_attachment_pending",
            # Gated in BlueprintService until BOQ or SOW is approved / attached.
            "deal_reg": "oem_pending",
            "lost": "lost",
        },
        "boq_attachment_pending": {
            "provide_boq_attachment": "boq_pending",
            "reject_boq_attachment": "boq_pending",
            "lost": "lost",
        },
        "sow_attachment_pending": {
            "provide_sow_attachment": "boq_pending",
            "reject_sow_attachment": "boq_pending",
            "lost": "lost",
        },
        "boq_approval": {
            "approve_boq": "deal_reg",
            "reject_boq": "boq_pending",
            # Legacy: older builds routed send_sow_approval into boq_approval.
            "approve_sow": "deal_reg",
            "reject_sow": "boq_pending",
            "lost": "lost",
        },
        "sow_approval": {
            "approve_sow": "deal_reg",
            "reject_sow": "boq_pending",
            "lost": "lost",
        },
        # Backward-compatible exit for opportunities already persisted in the
        # former standalone SOW stage.
        "sow_optional": {
            "attach_sow": "deal_reg",
            "skip_sow": "deal_reg",
            "lost": "lost",
        },
        "deal_reg": {
            "attach_boq": "deal_reg",
            "attach_sow": "deal_reg",
            "deal_reg": "oem_pending",
            "lost": "lost",
            "send_boq_approval": "boq_approval",
            "send_sow_approval": "sow_approval",
            "send_boq_for_attachment": "boq_attachment_pending",
            "send_sow_for_attachment": "sow_attachment_pending",
        },
        # After BOQ/SOW (and Deal Reg when needed), attach the vendor quotation
        # directly — no separate "Vendor Quotation Received" acknowledgement.
        "oem_pending": {"attach_oem_quote": "quote_ready", "lost": "lost"},
        # Legacy: opportunities already marked received before the attach-only flow.
        "oem_attached": {"attach_oem_quote": "quote_ready", "lost": "lost"},
        "quote_ready": {"create_quote": "quote_in_progress", "lost": "lost"},
        # Quote acceptance wins the deal commercially; PO/OVF continue as
        # fulfilment. Deal Lost is not offered after the quote is accepted.
        "quote_in_progress": {"quote_accepted": "po_pending", "lost": "lost"},
        "po_pending": {
            # Attach Customer PO also starts the Finance → Legal → Management chain.
            "attach_po": "po_approval",
        },
        # Customer PO validation runs Finance (tax/GST) → Legal (terms &
        # conditions) → Management. The first two stages stay in ``po_approval``
        # and each one raises the next stage's My Jobs task on approval.
        "po_approval": {
            "approve_po_finance": "po_approval",
            "reject_po_finance": "po_pending",
            "approve_po_terms": "po_approval",
            "reject_po_terms": "po_pending",
            "approve_po": "ovf_ready",
            "reject_po": "po_pending",
        },
        "ovf_ready": {"create_ovf": "ovf_ready", "deal_won": "won"},
        "won": {},
        "lost": {},
    },
    QUOTE: {
        # Self-serve quote UI only offers Send for Approval from draft.
        # ``approve_internally`` / ``reject_internally`` run via My Jobs after
        # the quote is locked in ``internal_approval``.
        "draft": {
            "send_for_approval": "internal_approval",
            "lost": "lost",
        },
        "internal_approval": {
            "approve_internally": "approved_internal",
            "reject_internally": "draft",
            "lost": "lost",
        },
        "approved_internal": {
            "send_to_customer": "sent_to_customer",
            # Edit (and negotiate) freezes this version and opens the next draft for re-approval.
            "negotiate": "draft",
            "lost": "lost",
        },
        "sent_to_customer": {
            # Create Quote Vn (negotiate) → next draft; Deal Won (accept); Deal Lost.
            "negotiate": "draft",
            "accept": "accepted",
            "lost": "lost",
        },
        "negotiation": {
            # Legacy rows stuck in negotiation: same three outcomes as sent_to_customer.
            "negotiate": "draft",
            "accept": "accepted",
            "lost": "lost",
        },
        "follow_up": {
            # Legacy follow-up rows: Create Quote Vn / Deal Won / Deal Lost.
            "negotiate": "draft",
            "accept": "accepted",
            "lost": "lost",
        },
        "accepted": {},
        "lost": {},
    },
    OVF: {
        "draft": {"send_for_approval": "approval"},
        "approval": {"approve": "approved", "reject": "draft"},
        "approved": {"share_to_scm": "shared_scm"},
        # Shared to SCM is the last CRM step — no further blueprint transitions.
        "shared_scm": {},
        "deal_won": {},
    },
}

TERMINAL_STATES: dict[str, set[str]] = {
    LEAD: {"converted", "lost"},
    OPPORTUNITY: {"won", "lost"},
    QUOTE: {"accepted", "lost"},
    OVF: {"shared_scm", "deal_won"},
}


def _merged_state_actions(
    entity: str,
    state: str,
    overlay_transitions: list[dict[str, Any]] | None = None,
) -> dict[str, str]:
    """Stock transitions for ``state``, plus Settings overlay rows for the entity.

    Overlay rows look like ``{from, action, to, approval_step_key?}``. When
    ``entity`` is omitted on a row it applies to opportunity (sales-flow builder).
    """
    table = _TRANSITIONS.get(entity)
    if table is None:
        raise InvalidBlueprintState(f"Unknown blueprint entity '{entity}'")
    merged = dict(table.get(state, {}))
    if not overlay_transitions:
        return merged
    for raw in overlay_transitions:
        if not isinstance(raw, dict):
            continue
        row_entity = str(raw.get("entity") or "opportunity").strip().lower()
        if row_entity != entity:
            continue
        from_state = str(raw.get("from") or "").strip()
        action = str(raw.get("action") or "").strip()
        to_state = str(raw.get("to") or "").strip()
        if not from_state or not action or not to_state:
            continue
        if from_state != state:
            continue
        merged[action] = to_state
    return merged


def allowed_actions(
    entity: str,
    state: str,
    overlay_transitions: list[dict[str, Any]] | None = None,
) -> list[str]:
    """Return the list of action names valid from ``state`` for ``entity``."""
    return sorted(
        _merged_state_actions(entity, state, overlay_transitions=overlay_transitions).keys()
    )


def transition(
    entity: str,
    state: str,
    action: str,
    ctx: Any = None,
    overlay_transitions: list[dict[str, Any]] | None = None,
) -> str:
    """Return the resulting state for ``action`` taken from ``state``.

    Raises :class:`InvalidBlueprintState` if the action is not permitted from
    the current state. ``ctx`` is accepted (and currently unused) so callers
    can pass request/service context for future extension without changing
    the call signature. Optional ``overlay_transitions`` merges tenant Settings
    custom edges onto the stock table.
    """
    _ = ctx
    state_actions = _merged_state_actions(entity, state, overlay_transitions=overlay_transitions)
    if action not in state_actions:
        raise InvalidBlueprintState(
            f"Action '{action}' is not allowed for {entity} in state '{state}'"
        )
    return state_actions[action]


def is_terminal(entity: str, state: str) -> bool:
    return state in TERMINAL_STATES.get(entity, set())


def assert_not_locked(record: Any) -> None:
    """Raise :class:`RecordLocked` if ``record.locked`` is truthy."""
    if getattr(record, "locked", False):
        raise RecordLocked(
            f"{record.__class__.__name__} {getattr(record, 'id', '')} is locked pending approval"
        )
