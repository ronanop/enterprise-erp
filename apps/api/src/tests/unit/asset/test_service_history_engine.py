"""Unit tests for AssetServiceHistoryEngine (FP-ASSET-013)."""

from types import SimpleNamespace

from modules.asset.service.engines.asset_service_history_engine import AssetServiceHistoryEngine


def test_record_sets_status() -> None:
    engine = AssetServiceHistoryEngine()
    row = SimpleNamespace(status="")
    engine.record(row)
    assert row.status == "recorded"
