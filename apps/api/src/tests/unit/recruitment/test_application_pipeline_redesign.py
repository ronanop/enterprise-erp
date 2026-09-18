"""Unit tests for redesigned application pipeline engine."""

import types

import pytest

from modules.recruitment.domain.exceptions import InvalidApplicationState
from modules.recruitment.service.engines.application_engine import (
    ApplicationEngine,
    can_mark_backed_out,
    can_mark_hired,
    next_stage,
)


def _row(**kwargs):
    defaults = {
        "status": "active",
        "current_stage_code": "sourced",
        "rejection_reason": None,
        "exited_at_stage": None,
        "exited_at": None,
        "exit_reason": None,
    }
    defaults.update(kwargs)
    return types.SimpleNamespace(**defaults)


def test_next_stage_order():
    assert next_stage("sourced") == "screening"
    assert next_stage("offer_sent") == "offer_accepted"
    assert next_stage("offer_accepted") is None


def test_advance_and_reject_requires_reason():
    engine = ApplicationEngine()
    row = _row()
    engine.advance(row, stage="screening")
    assert row.current_stage_code == "screening"
    assert row.status == "active"

    with pytest.raises(InvalidApplicationState):
        engine.reject(row, reason="  ")

    engine.reject(row, reason="Not a fit")
    assert row.status == "rejected"
    assert row.exited_at_stage == "screening"
    assert row.exit_reason == "Not a fit"


def test_hired_and_backed_out_only_from_offer_accepted():
    engine = ApplicationEngine()
    row = _row(current_stage_code="offer_sent")
    assert not can_mark_hired(row.current_stage_code, row.status)

    with pytest.raises(InvalidApplicationState):
        engine.mark_hired(row)

    row.current_stage_code = "offer_accepted"
    assert can_mark_hired(row.current_stage_code, row.status)
    assert can_mark_backed_out(row.current_stage_code, row.status)

    with pytest.raises(InvalidApplicationState):
        engine.mark_backed_out(row, reason="")

    engine.mark_backed_out(row, reason="Accepted another offer")
    assert row.status == "backed_out"
    assert row.exit_reason == "Accepted another offer"

    row2 = _row(current_stage_code="offer_accepted")
    engine.mark_hired(row2)
    assert row2.status == "hired"
