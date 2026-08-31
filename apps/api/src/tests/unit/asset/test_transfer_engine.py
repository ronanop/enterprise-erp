"""AssetTransferEngine lifecycle tests."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetTransferState
from modules.asset.service.engines.asset_transfer_engine import AssetTransferEngine


def _row(status: str):
    return SimpleNamespace(status=status)


def test_submit_then_approve_then_execute() -> None:
    engine = AssetTransferEngine()
    row = _row("draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.execute(row)
    assert row.status == "completed"


def test_cancel_draft_sets_cancelled() -> None:
    engine = AssetTransferEngine()
    row = _row("draft")
    engine.cancel_draft(row)
    assert row.status == "cancelled"


def test_reopen_requires_cancelled_rejected() -> None:
    engine = AssetTransferEngine()
    row = _row("cancelled")
    engine.reopen(row, workflow_status="rejected")
    assert row.status == "draft"


@pytest.mark.parametrize(
    ("method_name", "start_status"),
    [
        ("submit", "submitted"),
        ("approve", "draft"),
        ("execute", "submitted"),
        ("cancel_draft", "submitted"),
    ],
)
def test_invalid_transition_raises(method_name: str, start_status: str) -> None:
    engine = AssetTransferEngine()
    row = _row(start_status)
    with pytest.raises(InvalidAssetTransferState):
        getattr(engine, method_name)(row)


def test_reopen_wrong_workflow_state_raises() -> None:
    engine = AssetTransferEngine()
    row = _row("cancelled")
    with pytest.raises(InvalidAssetTransferState):
        engine.reopen(row, workflow_status="approved")
