"""Unit tests for InsuranceValidator (FP-ASSET-010)."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import InsuranceValidationError
from modules.asset.service.insurance_validator import InsuranceValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_policy_number() -> None:
    validator = InsuranceValidator(MagicMock())
    with pytest.raises(InsuranceValidationError, match="policy_number"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "insurer_name": "Acme", "start_date": date(2026, 1, 1), "end_date": date(2027, 1, 1)},
        )


def test_create_blocks_disposed_asset() -> None:
    validator = InsuranceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(InsuranceValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "policy_number": "POL-001",
                    "insurer_name": "Acme",
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2027, 1, 1),
                },
            )


def test_active_update_rejects_end_date_change() -> None:
    validator = InsuranceValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row = SimpleNamespace(
        status="active",
        asset_id=asset_id,
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        policy_number="POL-001",
        insurer_name="Acme",
        vendor_id=None,
        coverage_amount=None,
    )
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(InsuranceValidationError, match="POST /renew"):
            validator.validate_update_fields(
                ctx,
                row,
                {"end_date": date(2028, 1, 1)},
            )


def test_renew_requires_later_end_date() -> None:
    validator = InsuranceValidator(MagicMock())
    row = SimpleNamespace(
        status="active",
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        asset_id=uuid4(),
    )
    with pytest.raises(InsuranceValidationError, match="greater than"):
        validator.validate_renew_readiness(
            _ctx(),
            row,
            new_end_date=date(2026, 6, 1),
        )


def test_close_requires_expired() -> None:
    validator = InsuranceValidator(MagicMock())
    row = SimpleNamespace(status="active")
    with pytest.raises(InsuranceValidationError, match="expired"):
        validator.validate_close_readiness(_ctx(), row)


def test_coverage_amount_must_be_positive() -> None:
    validator = InsuranceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(InsuranceValidationError, match="coverage_amount"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "policy_number": "POL-001",
                    "insurer_name": "Acme",
                    "start_date": date(2026, 1, 1),
                    "end_date": date(2027, 1, 1),
                    "coverage_amount": Decimal("0"),
                },
            )
