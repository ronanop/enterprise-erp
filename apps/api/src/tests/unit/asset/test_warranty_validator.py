"""Unit tests for WarrantyValidator (FP-ASSET-009)."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import WarrantyValidationError
from modules.asset.service.warranty_validator import WarrantyValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_asset_id() -> None:
    validator = WarrantyValidator(MagicMock())
    with pytest.raises(WarrantyValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_requires_dates() -> None:
    validator = WarrantyValidator(MagicMock())
    with pytest.raises(WarrantyValidationError, match="start_date"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4()},
        )


def test_create_blocks_disposed_asset() -> None:
    validator = WarrantyValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(WarrantyValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2027, 1, 1),
                    "warranty_type": "manufacturer",
                },
            )


def test_create_requires_vendor_for_service() -> None:
    validator = WarrantyValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(WarrantyValidationError, match="vendor_id"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2027, 1, 1),
                    "warranty_type": "service",
                },
            )


def test_activate_requires_draft() -> None:
    validator = WarrantyValidator(MagicMock())
    row = SimpleNamespace(
        status="active",
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        warranty_type="manufacturer",
        vendor_id=None,
        asset_id=uuid4(),
        company_id=uuid4(),
        id=uuid4(),
    )
    with pytest.raises(WarrantyValidationError, match="draft"):
        validator.validate_activate_readiness(_ctx(), row)


def test_extend_requires_later_end_date() -> None:
    validator = WarrantyValidator(MagicMock())
    row = SimpleNamespace(
        status="active",
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        asset_id=uuid4(),
    )
    with pytest.raises(WarrantyValidationError, match="greater than"):
        validator.validate_extend_readiness(
            _ctx(),
            row,
            new_end_date=date(2026, 6, 1),
        )


def test_update_rejects_expired() -> None:
    validator = WarrantyValidator(MagicMock())
    row = SimpleNamespace(status="expired", asset_id=uuid4())
    with pytest.raises(WarrantyValidationError, match="draft or active"):
        validator.validate_update_fields(_ctx(), row, {})


def test_active_update_rejects_end_date_change() -> None:
    validator = WarrantyValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row = SimpleNamespace(
        status="active",
        asset_id=asset_id,
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        warranty_type="manufacturer",
        vendor_id=None,
    )
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(WarrantyValidationError, match="POST /extend"):
            validator.validate_update_fields(
                ctx,
                row,
                {"end_date": date(2028, 1, 1)},
            )


def test_expire_rejects_draft() -> None:
    validator = WarrantyValidator(MagicMock())
    row = SimpleNamespace(status="draft")
    with pytest.raises(WarrantyValidationError, match="active or extended"):
        validator.validate_expire_readiness(_ctx(), row)
