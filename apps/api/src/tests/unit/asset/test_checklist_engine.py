"""Unit tests for AssetChecklistEngine (FP-ASSET-014)."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetChecklistState
from modules.asset.service.engines.asset_checklist_engine import AssetChecklistEngine


def test_complete_sets_status_and_timestamp() -> None:
    engine = AssetChecklistEngine()
    row = SimpleNamespace(status="draft", completed_at=None)
    when = datetime(2026, 7, 30, tzinfo=timezone.utc)
    engine.complete(row, completed_at=when)
    assert row.status == "completed"
    assert row.completed_at == when


def test_complete_rejects_non_draft() -> None:
    engine = AssetChecklistEngine()
    row = SimpleNamespace(status="completed", completed_at=None)
    with pytest.raises(InvalidAssetChecklistState, match="draft"):
        engine.complete(row, completed_at=datetime.now(timezone.utc))


def test_cancel_from_draft() -> None:
    engine = AssetChecklistEngine()
    row = SimpleNamespace(status="draft")
    engine.cancel(row)
    assert row.status == "cancelled"


def test_cancel_rejects_non_draft() -> None:
    engine = AssetChecklistEngine()
    row = SimpleNamespace(status="completed")
    with pytest.raises(InvalidAssetChecklistState, match="draft"):
        engine.cancel(row)
