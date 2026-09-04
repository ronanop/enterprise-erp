"""Unit tests for AssetInsuranceEngine (FP-ASSET-010)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetInsuranceState
from modules.asset.service.engines.asset_insurance_engine import AssetInsuranceEngine


def test_activate_renew_expire_close_transitions() -> None:
    engine = AssetInsuranceEngine()
    row = SimpleNamespace(status="draft")

    engine.activate(row)
    assert row.status == "active"

    engine.renew(row)
    assert row.status == "renewed"

    engine.expire(row)
    assert row.status == "expired"

    engine.close(row)
    assert row.status == "cancelled"


def test_expire_from_active() -> None:
    row = SimpleNamespace(status="active")
    AssetInsuranceEngine().expire(row)
    assert row.status == "expired"


def test_activate_rejects_non_draft() -> None:
    with pytest.raises(InvalidAssetInsuranceState, match="draft"):
        AssetInsuranceEngine().activate(SimpleNamespace(status="active"))


def test_renew_rejects_non_active() -> None:
    with pytest.raises(InvalidAssetInsuranceState, match="active"):
        AssetInsuranceEngine().renew(SimpleNamespace(status="renewed"))
