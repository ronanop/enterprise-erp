"""Unit tests for MeterReadingService (FP-ASSET-015)."""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.domain.exceptions import MeterReadingValidationError
from modules.asset.service.meter_reading_service import MeterReadingService
from modules.foundation.domain.value_objects import TenantContext


def test_service_wires_validator_and_engine() -> None:
    svc = MeterReadingService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None


def test_create_forces_recorded_status() -> None:
    svc = MeterReadingService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    created = MagicMock(status="recorded", asset_id=uuid4())
    now = datetime.now(timezone.utc)
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "lock_create_scope", return_value=None),
        patch.object(svc._validator, "validate_create_fields", return_value=None),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        svc.create(
            ctx,
            asset_id=uuid4(),
            meter_type="odometer",
            reading_value=Decimal("100"),
            reading_at=now,
            status="void",
        )
        assert create.call_args.kwargs["status"] == "recorded"


def test_void_claim_conflict_skips_engine() -> None:
    svc = MeterReadingService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    row = MagicMock(id=uuid4(), status="recorded", version=1)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_void_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._engine, "void") as void:
                    with pytest.raises(ConflictException):
                        svc.void(ctx, row.id)
                    void.assert_not_called()
