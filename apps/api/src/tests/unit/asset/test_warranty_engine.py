"""Unit tests for AssetWarrantyEngine (FP-ASSET-009)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetWarrantyState
from modules.asset.service.engines.asset_warranty_engine import AssetWarrantyEngine


def test_activate_extend_expire_transitions() -> None:
    engine = AssetWarrantyEngine()
    row = SimpleNamespace(status="draft")

    engine.activate(row)
    assert row.status == "active"

    engine.extend(row)
    assert row.status == "extended"

    engine.expire(row)
    assert row.status == "expired"


def test_expire_from_active() -> None:
    row = SimpleNamespace(status="active")
    AssetWarrantyEngine().expire(row)
    assert row.status == "expired"


def test_activate_rejects_non_draft() -> None:
    with pytest.raises(InvalidAssetWarrantyState, match="draft"):
        AssetWarrantyEngine().activate(SimpleNamespace(status="active"))


def test_extend_rejects_non_active() -> None:
    with pytest.raises(InvalidAssetWarrantyState, match="active"):
        AssetWarrantyEngine().extend(SimpleNamespace(status="extended"))
