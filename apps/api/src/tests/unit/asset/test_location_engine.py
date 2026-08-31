"""Unit tests for AssetLocationEngine (FP-ASSET-012)."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetLocationState
from modules.asset.service.engines.asset_location_engine import AssetLocationEngine


def test_activate_sets_active_current() -> None:
    engine = AssetLocationEngine()
    row = SimpleNamespace(status="historical", is_current=False)
    engine.activate(row)
    assert row.status == "active"
    assert row.is_current is True


def test_mark_historical_sets_historical() -> None:
    engine = AssetLocationEngine()
    row = SimpleNamespace(status="active", is_current=True)
    engine.mark_historical(row)
    assert row.status == "historical"
    assert row.is_current is False


def test_complete_sets_effective_to() -> None:
    engine = AssetLocationEngine()
    effective_to = datetime(2026, 7, 30, tzinfo=timezone.utc)
    row = SimpleNamespace(status="active", is_current=True, effective_to=None)
    engine.complete(row, effective_to=effective_to)
    assert row.status == "historical"
    assert row.is_current is False
    assert row.effective_to == effective_to


def test_complete_rejects_non_active() -> None:
    with pytest.raises(InvalidAssetLocationState, match="active"):
        AssetLocationEngine().complete(SimpleNamespace(status="historical", is_current=True))


def test_complete_rejects_non_current() -> None:
    with pytest.raises(InvalidAssetLocationState, match="current"):
        AssetLocationEngine().complete(SimpleNamespace(status="active", is_current=False))
