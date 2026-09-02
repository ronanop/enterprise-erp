"""Unit tests for AssetDepreciationEngine formulas (FP-ASSET-006)."""

from decimal import Decimal
from types import SimpleNamespace

import pytest

from modules.asset.domain.exceptions import InvalidAssetDepreciationState
from modules.asset.service.engines.asset_depreciation_engine import AssetDepreciationEngine


def _asset(**kwargs):
    base = dict(
        purchase_cost=Decimal("12000.0000"),
        salvage_value=Decimal("0.0000"),
        current_book_value=Decimal("12000.0000"),
        useful_life_months=12,
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_straight_line_monthly() -> None:
    engine = AssetDepreciationEngine()
    row = SimpleNamespace(status="draft", method="straight_line", units_produced=None)
    result = engine.calculate(row, asset=_asset())
    assert result.amount == Decimal("1000.0000")
    assert result.book_value_after == Decimal("11000.0000")
    assert row.status == "calculated"


def test_wdv_uses_current_book_value() -> None:
    engine = AssetDepreciationEngine()
    row = SimpleNamespace(status="draft", method="wdv", units_produced=None)
    result = engine.calculate(
        row,
        asset=_asset(current_book_value=Decimal("6000.0000"), useful_life_months=12),
    )
    assert result.amount == Decimal("500.0000")
    assert result.book_value_after == Decimal("5500.0000")


def test_never_below_salvage() -> None:
    engine = AssetDepreciationEngine()
    row = SimpleNamespace(status="draft", method="straight_line", units_produced=None)
    result = engine.calculate(
        row,
        asset=_asset(
            purchase_cost=Decimal("1000"),
            salvage_value=Decimal("900"),
            current_book_value=Decimal("905"),
            useful_life_months=12,
        ),
    )
    assert result.book_value_after >= Decimal("900")
    assert result.amount == Decimal("5.0000")
    assert result.book_value_after == Decimal("900.0000")


def test_units_of_production() -> None:
    engine = AssetDepreciationEngine()
    row = SimpleNamespace(
        status="draft",
        method="units_of_production",
        units_produced=Decimal("100"),
    )
    result = engine.calculate(
        row,
        asset=_asset(purchase_cost=Decimal("10000"), salvage_value=Decimal("0")),
        estimated_total_units=Decimal("1000"),
    )
    assert result.amount == Decimal("1000.0000")


def test_calculate_rejects_zero_amount() -> None:
    engine = AssetDepreciationEngine()
    row = SimpleNamespace(status="draft", method="straight_line", units_produced=None)
    with pytest.raises(InvalidAssetDepreciationState, match="greater than zero"):
        engine.calculate(
            row,
            asset=_asset(
                purchase_cost=Decimal("1000"),
                salvage_value=Decimal("1000"),
                current_book_value=Decimal("1000"),
                useful_life_months=12,
            ),
        )


def test_reverse_and_post_transitions() -> None:
    engine = AssetDepreciationEngine()
    row = SimpleNamespace(status="calculated")
    engine.post(row)
    assert row.status == "posted"
    engine.reverse(row)
    assert row.status == "reversed"
