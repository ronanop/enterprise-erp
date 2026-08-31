"""Unit tests for ServiceHistoryValidator (FP-ASSET-013)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import ServiceHistoryValidationError
from modules.asset.service.service_history_validator import ServiceHistoryValidator
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
    validator = ServiceHistoryValidator(MagicMock())
    with pytest.raises(ServiceHistoryValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_requires_maintenance_id() -> None:
    validator = ServiceHistoryValidator(MagicMock())
    with pytest.raises(ServiceHistoryValidationError, match="maintenance_id"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4()},
        )


def test_create_requires_completed_maintenance() -> None:
    validator = ServiceHistoryValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    maintenance_id = uuid4()
    maintenance = SimpleNamespace(
        id=maintenance_id,
        asset_id=asset_id,
        company_id=ctx.company_id,
        status="in_progress",
    )
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id)
    with patch.object(validator._maintenances, "get", return_value=maintenance):
        with patch.object(validator._assets, "get", return_value=asset):
            with pytest.raises(ServiceHistoryValidationError, match="completed"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "maintenance_id": maintenance_id,
                        "service_summary": "Replaced filter",
                    },
                )


def test_create_requires_matching_asset() -> None:
    validator = ServiceHistoryValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    maintenance_id = uuid4()
    maintenance = SimpleNamespace(
        id=maintenance_id,
        asset_id=uuid4(),
        company_id=ctx.company_id,
        status="completed",
    )
    with patch.object(validator._maintenances, "get", return_value=maintenance):
        with pytest.raises(ServiceHistoryValidationError, match="asset_id must match"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "maintenance_id": maintenance_id,
                    "service_summary": "Replaced filter",
                },
            )


@pytest.mark.parametrize("asset_status", ["disposed", "written_off", "permanently_retired"])
def test_create_rejects_non_operational_asset(asset_status: str) -> None:
    validator = ServiceHistoryValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    maintenance_id = uuid4()
    maintenance = SimpleNamespace(
        id=maintenance_id,
        asset_id=asset_id,
        company_id=ctx.company_id,
        status="completed",
    )
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status=asset_status)
    with patch.object(validator._maintenances, "get", return_value=maintenance):
        with patch.object(validator._assets, "get", return_value=asset):
            with pytest.raises(ServiceHistoryValidationError, match="permanently retired"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "maintenance_id": maintenance_id,
                        "service_summary": "Should fail",
                    },
                )


def test_create_rejects_status_override() -> None:
    validator = ServiceHistoryValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    maintenance_id = uuid4()
    maintenance = SimpleNamespace(
        id=maintenance_id,
        asset_id=asset_id,
        company_id=ctx.company_id,
        status="completed",
    )
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._maintenances, "get", return_value=maintenance):
        with patch.object(validator._assets, "get", return_value=asset):
            with pytest.raises(ServiceHistoryValidationError, match="recorded status"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "maintenance_id": maintenance_id,
                        "service_summary": "Override attempt",
                        "status": "void",
                    },
                )


def test_negative_cost_blocked() -> None:
    validator = ServiceHistoryValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    maintenance_id = uuid4()
    maintenance = SimpleNamespace(
        id=maintenance_id,
        asset_id=asset_id,
        company_id=ctx.company_id,
        status="completed",
    )
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._maintenances, "get", return_value=maintenance):
        with patch.object(validator._assets, "get", return_value=asset):
            with pytest.raises(ServiceHistoryValidationError, match="cost_amount"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "maintenance_id": maintenance_id,
                        "service_summary": "Replaced filter",
                        "cost_amount": -1,
                    },
                )
