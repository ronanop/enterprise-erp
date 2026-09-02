"""Unit tests for MeterReadingValidator (FP-ASSET-015)."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import MeterReadingValidationError
from modules.asset.service.meter_reading_validator import MeterReadingValidator
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
    validator = MeterReadingValidator(MagicMock())
    with pytest.raises(MeterReadingValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_rejects_invalid_meter_type() -> None:
    validator = MeterReadingValidator(MagicMock())
    with pytest.raises(MeterReadingValidationError, match="meter_type"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "meter_type": "invalid", "reading_value": 1},
        )


def test_create_rejects_status_override() -> None:
    validator = MeterReadingValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    now = datetime.now(timezone.utc)
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._readings, "find_duplicate_reading", return_value=None):
            with patch.object(validator._readings, "find_latest_reading", return_value=None):
                with pytest.raises(MeterReadingValidationError, match="recorded status"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset_id,
                            "meter_type": "odometer",
                            "reading_value": Decimal("100"),
                            "reading_at": now,
                            "status": "void",
                        },
                    )


def test_create_rejects_decreasing_value() -> None:
    validator = MeterReadingValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    latest = SimpleNamespace(reading_value=Decimal("500"))
    now = datetime.now(timezone.utc)
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._readings, "find_duplicate_reading", return_value=None):
            with patch.object(validator._readings, "find_latest_reading", return_value=latest):
                with pytest.raises(MeterReadingValidationError, match="less than the latest"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset_id,
                            "meter_type": "odometer",
                            "reading_value": Decimal("100"),
                            "reading_at": now,
                        },
                    )


@pytest.mark.parametrize("user_type", ["employee", "tenant_admin", "super_admin"])
def test_create_rejects_asset_company_mismatch(user_type: str) -> None:
    validator = MeterReadingValidator(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type=user_type,
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=uuid4(), status="active")
    now = datetime.now(timezone.utc)
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MeterReadingValidationError, match="does not belong to this company"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "meter_type": "odometer",
                    "reading_value": Decimal("100"),
                    "reading_at": now,
                },
            )


def test_create_rejects_future_reading_at() -> None:
    validator = MeterReadingValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    future = datetime.now(timezone.utc) + timedelta(days=1)
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._readings, "find_duplicate_reading", return_value=None):
            with patch.object(validator._readings, "find_latest_reading", return_value=None):
                with pytest.raises(MeterReadingValidationError, match="future"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset_id,
                            "meter_type": "odometer",
                            "reading_value": Decimal("100"),
                            "reading_at": future,
                        },
                    )


def test_void_requires_recorded_status() -> None:
    validator = MeterReadingValidator(MagicMock())
    row = SimpleNamespace(status="void")
    with pytest.raises(MeterReadingValidationError, match="Only recorded"):
        validator.validate_void_readiness(_ctx(), row)
