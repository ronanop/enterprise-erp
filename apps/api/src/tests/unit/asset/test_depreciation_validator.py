"""Unit tests for DepreciationValidator (FP-ASSET-006)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import DepreciationValidationError
from modules.asset.service.depreciation_validator import DepreciationValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_asset_and_period() -> None:
    validator = DepreciationValidator(MagicMock())
    with pytest.raises(DepreciationValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_blocks_disposed() -> None:
    validator = DepreciationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="disposed",
        purchase_cost=1000,
        useful_life_months=12,
        purchase_date=None,
        depreciation_method="straight_line",
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DepreciationValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "period_year": 2026,
                    "period_month": 7,
                    "method": "straight_line",
                },
            )


def test_create_blocks_open_disposal() -> None:
    validator = DepreciationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        purchase_cost=1000,
        useful_life_months=12,
        purchase_date=None,
        depreciation_method="straight_line",
    )
    pending = SimpleNamespace(document_number="ADISP-1")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=pending):
            with pytest.raises(DepreciationValidationError, match="open disposal"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset.id,
                        "period_year": 2026,
                        "period_month": 7,
                        "method": "straight_line",
                    },
                )


def test_create_blocks_duplicate_period() -> None:
    validator = DepreciationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        purchase_cost=1000,
        useful_life_months=12,
        purchase_date=None,
        depreciation_method="straight_line",
    )
    existing = SimpleNamespace(document_number="ADEP-1")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._deps, "find_for_asset_period", return_value=existing):
                with pytest.raises(DepreciationValidationError, match="already has depreciation"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset.id,
                            "period_year": 2026,
                            "period_month": 7,
                            "method": "straight_line",
                        },
                    )


def test_post_rejects_already_posted() -> None:
    validator = DepreciationValidator(MagicMock())
    row = SimpleNamespace(
        status="posted",
        finance_journal_id=uuid4(),
        depreciation_amount=10,
        asset_id=uuid4(),
        method="straight_line",
    )
    with pytest.raises(DepreciationValidationError, match="already posted"):
        validator.validate_post_readiness(_ctx(), row)


def test_reverse_rejects_already_reversed() -> None:
    validator = DepreciationValidator(MagicMock())
    row = SimpleNamespace(
        status="reversed",
        depreciation_amount=10,
        asset_id=uuid4(),
    )
    with pytest.raises(DepreciationValidationError, match="already reversed"):
        validator.validate_reverse_readiness(_ctx(), row)
