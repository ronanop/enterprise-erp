"""Assignment return outcomes → operational status actions (CR-004 Phase 2B-2)."""

from __future__ import annotations

from enum import Enum

RETURN_CONDITION_GOOD = "good"
RETURN_CONDITION_OUTDATED = "outdated"
RETURN_CONDITION_DEAD = "dead"

RETURN_CONDITION_VALUES = frozenset(
    {
        RETURN_CONDITION_GOOD,
        RETURN_CONDITION_OUTDATED,
        RETURN_CONDITION_DEAD,
    }
)


class AssignmentReturnCondition(str, Enum):
    GOOD = RETURN_CONDITION_GOOD
    OUTDATED = RETURN_CONDITION_OUTDATED
    DEAD = RETURN_CONDITION_DEAD


RETURN_CONDITION_TO_OPERATIONAL_ACTION: dict[str, str] = {
    RETURN_CONDITION_GOOD: "return_to_ready",
    RETURN_CONDITION_OUTDATED: "retire",
    RETURN_CONDITION_DEAD: "mark_pending_disposal",
}


def operational_action_for_return_condition(condition: str) -> str:
    key = (condition or RETURN_CONDITION_GOOD).strip().lower()
    action = RETURN_CONDITION_TO_OPERATIONAL_ACTION.get(key)
    if action is None:
        from modules.asset.domain.exceptions import AssignmentValidationError

        raise AssignmentValidationError(
            f"return_condition must be one of: {', '.join(sorted(RETURN_CONDITION_VALUES))}"
        )
    return action
