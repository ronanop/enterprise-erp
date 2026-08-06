"""Unit tests for AssetOperationalStatusEngine (CR-004 Phase 2B-1)."""

import pytest

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.operational_status_exceptions import (
    InvalidTransition,
    TerminalState,
    UnknownOperationalStatus,
)
from modules.asset.domain.operational_status_rules import ALLOWED_OPERATIONAL_TRANSITIONS
from modules.asset.service.engines.asset_operational_status_engine import AssetOperationalStatusEngine

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value

ENGINE = AssetOperationalStatusEngine()


@pytest.mark.parametrize(
    ("current", "target"),
    sorted(ALLOWED_OPERATIONAL_TRANSITIONS),
)
def test_allowed_transitions_resolve(current: str, target: str) -> None:
    assert ENGINE.resolve_transition(current, target) == target
    assert ENGINE.is_allowed(current, target) is True


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (Ready, Disposed),
        (Ready, Retired),
        (Retired, Assigned),
        (Retired, Ready),
    ],
)
def test_explicitly_blocked_transitions(current: str, target: str) -> None:
    with pytest.raises(InvalidTransition, match="not permitted"):
        ENGINE.assert_transition(current, target)


@pytest.mark.parametrize(
    "target",
    [Ready, Assigned, Retired, Pending],
)
def test_disposed_terminal_blocks_all_outbound(target: str) -> None:
    with pytest.raises(TerminalState):
        ENGINE.assert_transition(Disposed, target)


def test_disposed_to_disposed_raises_invalid_not_terminal_first() -> None:
    with pytest.raises(InvalidTransition):
        ENGINE.assert_transition(Disposed, Disposed)


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (Ready, Pending),
        (Ready, Ready),
        (Assigned, Assigned),
        (Retired, Pending),
        (Retired, Disposed),
        (Pending, Ready),
        (Pending, Assigned),
        (Pending, Retired),
        (Assigned, Disposed),
    ],
)
def test_other_disallowed_transitions(current: str, target: str) -> None:
    with pytest.raises(InvalidTransition):
        ENGINE.assert_transition(current, target)


def test_null_current_raises_unknown() -> None:
    with pytest.raises(UnknownOperationalStatus, match="not set"):
        ENGINE.assert_transition(None, Assigned)


def test_unknown_current_raises() -> None:
    with pytest.raises(UnknownOperationalStatus):
        ENGINE.assert_transition("INVALID", Assigned)


def test_unknown_target_raises() -> None:
    with pytest.raises(UnknownOperationalStatus):
        ENGINE.assert_transition(Ready, "INVALID")


def test_assert_known_status_accepts_valid() -> None:
    assert ENGINE.assert_known_status(Ready) == Ready


def test_is_allowed_false_for_blocked() -> None:
    assert ENGINE.is_allowed(Ready, Retired) is False
