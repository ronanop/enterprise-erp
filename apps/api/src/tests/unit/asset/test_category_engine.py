"""Unit tests for AssetCategoryEngine (CR-001)."""

from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetCategoryState
from modules.asset.service.engines.asset_category_engine import AssetCategoryEngine


def test_deactivate_sets_inactive() -> None:
    row = SimpleNamespace(status="active")
    AssetCategoryEngine().deactivate(row)
    assert row.status == "inactive"


def test_deactivate_rejects_inactive() -> None:
    with pytest.raises(InvalidAssetCategoryState, match="active"):
        AssetCategoryEngine().deactivate(SimpleNamespace(status="inactive"))


def test_reactivate_sets_active() -> None:
    row = SimpleNamespace(status="inactive")
    AssetCategoryEngine().activate(row)
    assert row.status == "active"


def test_reactivate_rejects_active() -> None:
    with pytest.raises(InvalidAssetCategoryState, match="inactive"):
        AssetCategoryEngine().activate(SimpleNamespace(status="active"))
