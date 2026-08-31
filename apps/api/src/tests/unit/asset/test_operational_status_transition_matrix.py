"""Transition matrix regression tests (CR-004 Phase 2B-1)."""

import pytest

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.operational_status_exceptions import InvalidTransition, TerminalState
from modules.asset.domain.operational_status_rules import ALLOWED_OPERATIONAL_TRANSITIONS
from modules.asset.service.engines.asset_operational_status_engine import AssetOperationalStatusEngine

ALL = [s.value for s in AssetOperationalStatus]
ENGINE = AssetOperationalStatusEngine()


def test_allowed_matrix_count() -> None:
    assert len(ALLOWED_OPERATIONAL_TRANSITIONS) == 12


@pytest.mark.parametrize("current", ALL)
@pytest.mark.parametrize("target", ALL)
def test_full_cartesian_classifies_edges(current: str, target: str) -> None:
    edge = (current, target)
    if edge in ALLOWED_OPERATIONAL_TRANSITIONS:
        assert ENGINE.resolve_transition(current, target) == target
        return
    if current == target:
        with pytest.raises(InvalidTransition):
            ENGINE.assert_transition(current, target)
        return
    if current == AssetOperationalStatus.DISPOSED.value:
        with pytest.raises((TerminalState, InvalidTransition)):
            ENGINE.assert_transition(current, target)
        return
    with pytest.raises(InvalidTransition):
        ENGINE.assert_transition(current, target)
