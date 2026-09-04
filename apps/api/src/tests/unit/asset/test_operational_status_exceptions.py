"""Operational status exception hierarchy (CR-004 Phase 2B-1)."""

from modules.asset.domain.operational_status_exceptions import (
    AssetNotFoundForOperationalStatus,
    InvalidOperationalAction,
    InvalidTransition,
    OperationalStatusException,
    TerminalState,
    UnknownOperationalStatus,
)


def test_exception_status_codes() -> None:
    assert InvalidTransition("x").status_code == 409
    assert TerminalState("x").status_code == 409
    assert UnknownOperationalStatus("x").status_code == 422
    assert InvalidOperationalAction("x").status_code == 422


def test_operational_status_exception_subclass() -> None:
    assert issubclass(InvalidTransition, OperationalStatusException)
    assert issubclass(TerminalState, OperationalStatusException)


def test_asset_not_found_type() -> None:
    exc = AssetNotFoundForOperationalStatus()
    assert "not found" in exc.message.lower()


def test_operational_status_conflict_type() -> None:
    from modules.asset.domain.operational_status_exceptions import OperationalStatusConflict

    exc = OperationalStatusConflict()
    assert exc.status_code == 409
