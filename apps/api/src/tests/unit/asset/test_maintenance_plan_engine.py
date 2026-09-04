"""Unit tests for AssetMaintenancePlanEngine (FP-ASSET-011)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetMaintenancePlanState
from modules.asset.service.engines.asset_maintenance_plan_engine import AssetMaintenancePlanEngine


def test_activate_pause_resume_close_transitions() -> None:
    engine = AssetMaintenancePlanEngine()
    row = SimpleNamespace(status="draft")

    engine.activate(row)
    assert row.status == "active"

    engine.pause(row)
    assert row.status == "paused"

    engine.resume(row)
    assert row.status == "active"

    engine.close(row)
    assert row.status == "closed"


def test_activate_rejects_non_draft() -> None:
    with pytest.raises(InvalidAssetMaintenancePlanState, match="draft"):
        AssetMaintenancePlanEngine().activate(SimpleNamespace(status="active"))


def test_pause_rejects_non_active() -> None:
    with pytest.raises(InvalidAssetMaintenancePlanState, match="active"):
        AssetMaintenancePlanEngine().pause(SimpleNamespace(status="draft"))


def test_resume_rejects_non_paused() -> None:
    with pytest.raises(InvalidAssetMaintenancePlanState, match="paused"):
        AssetMaintenancePlanEngine().resume(SimpleNamespace(status="active"))


def test_close_rejects_draft() -> None:
    with pytest.raises(InvalidAssetMaintenancePlanState, match="active or paused"):
        AssetMaintenancePlanEngine().close(SimpleNamespace(status="draft"))
