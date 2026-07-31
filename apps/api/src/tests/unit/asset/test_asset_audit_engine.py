"""Unit tests for AssetAuditEngine (FP-ASSET-008)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetAuditState
from modules.asset.service.engines.asset_audit_engine import AssetAuditEngine


def test_start_complete_and_cancel_transitions() -> None:
    engine = AssetAuditEngine()
    row = SimpleNamespace(status="planned")

    engine.start(row)
    assert row.status == "in_progress"

    engine.complete(row)
    assert row.status == "completed"

    with pytest.raises(InvalidAssetAuditState, match="cannot be cancelled"):
        engine.cancel(row)

    cancelled = SimpleNamespace(status="planned")
    engine.cancel(cancelled)
    assert cancelled.status == "cancelled"


def test_start_rejects_non_planned_audit() -> None:
    with pytest.raises(InvalidAssetAuditState, match="planned"):
        AssetAuditEngine().start(SimpleNamespace(status="cancelled"))
