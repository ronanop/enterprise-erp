"""AssetAssignmentEngine lifecycle tests."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetAssignmentState
from modules.asset.service.engines.asset_assignment_engine import AssetAssignmentEngine


def _row(status: str):
    return SimpleNamespace(status=status)


def test_submit_approve_activate_return() -> None:
    engine = AssetAssignmentEngine()
    row = _row("draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.activate(row)
    assert row.status == "active"
    engine.return_assignment(row)
    assert row.status == "returned"


def test_cancel_draft() -> None:
    engine = AssetAssignmentEngine()
    row = _row("draft")
    engine.cancel_draft(row)
    assert row.status == "cancelled"


def test_reopen_requires_rejected() -> None:
    engine = AssetAssignmentEngine()
    row = _row("cancelled")
    engine.reopen(row, workflow_status="rejected")
    assert row.status == "draft"


@pytest.mark.parametrize(
    ("method_name", "start_status"),
    [
        ("submit", "submitted"),
        ("approve", "draft"),
        ("activate", "submitted"),
        ("return_assignment", "draft"),
        ("cancel_draft", "submitted"),
    ],
)
def test_invalid_transition_raises(method_name: str, start_status: str) -> None:
    engine = AssetAssignmentEngine()
    row = _row(start_status)
    with pytest.raises(InvalidAssetAssignmentState):
        getattr(engine, method_name)(row)
