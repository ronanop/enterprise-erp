"""Assignment return condition mapping (CR-004 Phase 2B-2)."""

import pytest

from modules.asset.domain.assignment_return_condition import (
    RETURN_CONDITION_VALUES,
    operational_action_for_return_condition,
)
from modules.asset.domain.exceptions import AssignmentValidationError


@pytest.mark.parametrize(
    ("condition", "action"),
    [
        ("good", "return_to_ready"),
        ("GOOD", "return_to_ready"),
        ("outdated", "retire"),
        ("dead", "mark_pending_disposal"),
    ],
)
def test_return_condition_maps_to_action(condition: str, action: str) -> None:
    assert operational_action_for_return_condition(condition) == action


def test_invalid_return_condition_raises() -> None:
    with pytest.raises(AssignmentValidationError):
        operational_action_for_return_condition("broken")


def test_return_condition_values_locked() -> None:
    assert RETURN_CONDITION_VALUES == frozenset({"good", "outdated", "dead"})
