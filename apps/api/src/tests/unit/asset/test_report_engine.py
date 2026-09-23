"""Unit tests for AssetReportEngine (FP-ASSET-018)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetReportState
from modules.asset.service.engines.asset_report_engine import AssetReportEngine


def test_finalize_from_draft() -> None:
    engine = AssetReportEngine()
    row = SimpleNamespace(status="draft")
    engine.finalize(row)
    assert row.status == "finalized"


def test_finalize_rejects_finalized() -> None:
    engine = AssetReportEngine()
    row = SimpleNamespace(status="finalized")
    with pytest.raises(InvalidAssetReportState, match="draft"):
        engine.finalize(row)


def test_build_metrics() -> None:
    engine = AssetReportEngine()
    metrics = engine.build_metrics(
        "asset_summary",
        rows=[{"id": "1"}],
        totals={"row_count": 1},
        filters={"company_id": "x"},
    )
    assert metrics["report_key"] == "asset_summary"
    assert metrics["rows"][0]["id"] == "1"
    assert "generated_at" in metrics


def test_shape_dashboard() -> None:
    engine = AssetReportEngine()
    dash = engine.shape_dashboard(
        kpis={"asset_count": 3},
        by_category=[],
        by_department=[],
        recent_transfers=[],
        recent_notifications=[],
        health={"pct_in_maintenance": 0},
        analytics_kpis={"document_count": 4},
        by_status=[{"status": "active", "count": 3}],
        documents={"total": 4},
        components={"total": 2},
        lifecycle={"stages": []},
        usage={"utilization_pct": 10},
    )
    assert dash["kpis"]["asset_count"] == 3
    assert dash["analytics_kpis"]["document_count"] == 4
    assert dash["by_status"][0]["status"] == "active"
    assert dash["documents"]["total"] == 4
    assert dash["components"]["total"] == 2
    assert "usage" in dash
    assert "lifecycle" in dash


def test_shape_export() -> None:
    engine = AssetReportEngine()
    payload = engine.shape_export(
        "asset_inventory",
        columns=[{"key": "asset_code", "label": "Code"}],
        rows=[{"asset_code": "A1"}],
    )
    assert payload["row_count"] == 1
    assert "csv" in payload["format_hints"]
