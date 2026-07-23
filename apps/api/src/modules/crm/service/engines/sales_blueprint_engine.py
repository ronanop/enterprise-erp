"""Table-driven state machine for the Sales CRM blueprint.

Governs the granular sales-process lifecycle that sits on top of the
existing (coarse) ``status`` / ``current_stage`` columns already used by the
legacy CRM lead & opportunity flows:

    LEAD:        open -> converted | lost
    OPPORTUNITY: open -> boq_pending -> boq_approval -> deal_reg ->
                 oem_pending -> oem_attached -> quote_ready ->
                 quote_in_progress -> po_pending -> po_approval ->
                 ovf_ready -> won | lost
    QUOTE:       draft -> internal_approval -> approved_internal ->
                 sent_to_customer -> negotiation | follow_up | accepted | lost
    OVF:         draft -> approval -> approved -> shared_scm -> deal_won

Every entity also supports a universal "lost" action from any non-terminal
state (per product rule: "Lost available until Deal Won"), except OVF which
has no lost state (it only exists after the deal is effectively secured).

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
            "lost": "lost",
        },
        "boq_pending": {
            "attach_boq": "boq_pending",
            "attach_sow": "boq_pending",
            "send_boq_approval": "boq_approval",
            "lost": "lost",
        },
        "boq_approval": {
            "approve_boq": "deal_reg",
            "reject_boq": "boq_pending",
            "lost": "lost",
        },
        # Backward-compatible exit for opportunities already persisted in the
        # former standalone SOW stage.
        "sow_optional": {
            "attach_sow": "deal_reg",
            "skip_sow": "deal_reg",
            "lost": "lost",
        },
        "deal_reg": {"deal_reg": "oem_pending", "lost": "lost"},
        "oem_pending": {"oem_received": "oem_attached", "lost": "lost"},
        "oem_attached": {"attach_oem_quote": "quote_ready", "lost": "lost"},
        "quote_ready": {"create_quote": "quote_in_progress", "lost": "lost"},
        "quote_in_progress": {"quote_accepted": "po_pending", "lost": "lost"},
        "po_pending": {
            "attach_po": "po_pending",
            "send_po_approval": "po_approval",
            "lost": "lost",
        },
        "po_approval": {"approve_po": "ovf_ready", "reject_po": "po_pending", "lost": "lost"},
        "ovf_ready": {"create_ovf": "ovf_ready", "deal_won": "won", "lost": "lost"},
        "won": {},
        "lost": {},
    },
    QUOTE: {
        # ``approve_internally`` is reachable straight from "draft" for the
        # healthy-margin fast path (QuoteService.approve_internally without
        # ``force``); it is also reachable from "internal_approval" once
        # Management resumes a "send for approval" My Jobs decision.
        "draft": {
            "send_for_approval": "internal_approval",
            "approve_internally": "approved_internal",
            "lost": "lost",
        },
        "internal_approval": {
            "approve_internally": "approved_internal",
            "reject_internally": "draft",
            "lost": "lost",
        },
        "approved_internal": {"send_to_customer": "sent_to_customer", "lost": "lost"},
        "sent_to_customer": {
            "negotiate": "negotiation",
            "follow_up": "follow_up",
            "accept": "accepted",
            "lost": "lost",
        },
        "negotiation": {
            "follow_up": "follow_up",
            "accept": "accepted",
            "negotiate": "negotiation",
            "lost": "lost",
        },
        "follow_up": {
            "negotiate": "negotiation",
            "accept": "accepted",
            "follow_up": "follow_up",
            "lost": "lost",
        },
        "accepted": {},
        "lost": {},
    },
    OVF: {
        "draft": {"send_for_approval": "approval"},
        "approval": {"approve": "approved", "reject": "draft"},
        "approved": {"share_to_scm": "shared_scm"},
        "shared_scm": {"deal_won": "deal_won"},
        "deal_won": {},
    },
}

TERMINAL_STATES: dict[str, set[str]] = {
    LEAD: {"converted", "lost"},
    OPPORTUNITY: {"won", "lost"},
    QUOTE: {"accepted", "lost"},
    OVF: {"deal_won"},
}


def allowed_actions(entity: str, state: str) -> list[str]:
    """Return the list of action names valid from ``state`` for ``entity``."""
    table = _TRANSITIONS.get(entity)
    if table is None:
        raise InvalidBlueprintState(f"Unknown blueprint entity '{entity}'")
    return sorted(table.get(state, {}).keys())


def transition(entity: str, state: str, action: str, ctx: Any = None) -> str:
    """Return the resulting state for ``action`` taken from ``state``.

    Raises :class:`InvalidBlueprintState` if the action is not permitted from
    the current state. ``ctx`` is accepted (and currently unused) so callers
    can pass request/service context for future extension without changing
    the call signature.
    """
    table = _TRANSITIONS.get(entity)
    if table is None:
        raise InvalidBlueprintState(f"Unknown blueprint entity '{entity}'")
    state_actions = table.get(state)
    if state_actions is None or action not in state_actions:
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
