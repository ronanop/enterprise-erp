"""Unit tests for OperationalStatusValidator (CR-004 Phase 2B-1)."""

import pytest

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.operational_status_exceptions import (
    InvalidOperationalAction,
    InvalidTransition,
    UnknownOperationalStatus,
)
from modules.asset.service.operational_status_validator import OperationalStatusValidator

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value

VALIDATOR = OperationalStatusValidator()


def test_validate_known_status_ok() -> None:
    assert VALIDATOR.validate_known_status(Ready) == Ready


def test_validate_known_status_null() -> None:
    with pytest.raises(UnknownOperationalStatus):
        VALIDATOR.validate_known_status(None)


def test_validate_transition_allowed() -> None:
    VALIDATOR.validate_transition(Ready, Assigned)


def test_validate_transition_blocked() -> None:
    with pytest.raises(InvalidTransition):
        VALIDATOR.validate_transition(Ready, Retired)


@pytest.mark.parametrize(
    ("action", "current", "expected_target"),
    [
        ("assign", Ready, Assigned),
        ("return_to_ready", Assigned, Ready),
        ("retire", Assigned, Retired),
        ("mark_pending_disposal", Assigned, Pending),
        ("complete_disposal", Pending, Disposed),
    ],
)
def test_validate_action_maps_to_target(action: str, current: str, expected_target: str) -> None:
    assert VALIDATOR.validate_action(current, action) == expected_target


def test_validate_action_unknown() -> None:
    with pytest.raises(InvalidOperationalAction):
        VALIDATOR.validate_action(Ready, "fly_to_moon")


def test_validate_action_wrong_source_state() -> None:
    with pytest.raises(InvalidTransition):
        VALIDATOR.validate_action(Ready, "retire")


def test_resolve_action_target_case_insensitive() -> None:
    assert VALIDATOR.resolve_action_target("ASSIGN") == Assigned


def test_validate_target_status_invalid() -> None:
    with pytest.raises(UnknownOperationalStatus):
        VALIDATOR.validate_transition(Ready, "BAD")
