"""Unit tests for AssetMaintenanceEngine (FP-ASSET-004)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetMaintenanceState
from modules.asset.service.engines.asset_maintenance_engine import AssetMaintenanceEngine


def test_submit_approve_schedule_start_complete() -> None:
    engine = AssetMaintenanceEngine()
    row = SimpleNamespace(status="draft")
    engine.submit(row)
    assert row.status == "submitted"
    engine.approve(row)
    assert row.status == "approved"
    engine.schedule(row)
    assert row.status == "scheduled"
    engine.start(row)
    assert row.status == "in_progress"
    engine.complete(row)
    assert row.status == "completed"


def test_start_from_approved_without_schedule() -> None:
    engine = AssetMaintenanceEngine()
    row = SimpleNamespace(status="approved")
    engine.start(row)
    assert row.status == "in_progress"


def test_cancel_and_reopen() -> None:
    engine = AssetMaintenanceEngine()
    row = SimpleNamespace(status="draft")
    engine.cancel_draft(row)
    assert row.status == "cancelled"
    engine.reopen(row, workflow_status="rejected")
    assert row.status == "draft"


def test_reopen_requires_rejected() -> None:
    engine = AssetMaintenanceEngine()
    row = SimpleNamespace(status="cancelled")
    with pytest.raises(InvalidAssetMaintenanceState, match="rejected"):
        engine.reopen(row, workflow_status="approved")
