"""Unit tests for AssetMeterReadingEngine (FP-ASSET-015)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetMeterReadingState
from modules.asset.service.engines.asset_meter_reading_engine import AssetMeterReadingEngine


def test_void_from_recorded() -> None:
    engine = AssetMeterReadingEngine()
    row = SimpleNamespace(status="recorded")
    engine.void(row)
    assert row.status == "void"


def test_void_rejects_non_recorded() -> None:
    engine = AssetMeterReadingEngine()
    row = SimpleNamespace(status="void")
    with pytest.raises(InvalidAssetMeterReadingState, match="recorded"):
        engine.void(row)
