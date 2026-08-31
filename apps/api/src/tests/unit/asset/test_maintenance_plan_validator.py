"""Unit tests for MaintenancePlanValidator (FP-ASSET-011)."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import MaintenancePlanValidationError
from modules.asset.service.maintenance_plan_validator import MaintenancePlanValidator
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
    validator = MaintenancePlanValidator(MagicMock())
    with pytest.raises(MaintenancePlanValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_requires_plan_name() -> None:
    validator = MaintenancePlanValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MaintenancePlanValidationError, match="plan_name"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "maintenance_type": "preventive"},
            )


def test_create_blocks_disposed_asset() -> None:
    validator = MaintenancePlanValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MaintenancePlanValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "plan_name": "Quarterly",
                    "maintenance_type": "preventive",
                },
            )


def test_activate_requires_next_due_date() -> None:
    validator = MaintenancePlanValidator(MagicMock())
    row = SimpleNamespace(
        status="draft",
        next_due_date=None,
        plan_name="Plan",
        maintenance_type="preventive",
        asset_id=uuid4(),
    )
    asset = SimpleNamespace(id=row.asset_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MaintenancePlanValidationError, match="next_due_date"):
            validator.validate_activate_readiness(_ctx(), row)


def test_close_rejects_draft() -> None:
    validator = MaintenancePlanValidator(MagicMock())
    row = SimpleNamespace(status="draft", asset_id=uuid4())
    with pytest.raises(MaintenancePlanValidationError, match="active or paused"):
        validator.validate_close_readiness(_ctx(), row)


def test_negative_frequency_blocked() -> None:
    validator = MaintenancePlanValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MaintenancePlanValidationError, match="frequency_days"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset.id,
                    "plan_name": "Plan",
                    "maintenance_type": "preventive",
                    "frequency_days": -1,
                },
            )


def test_plan_link_requires_active_plan() -> None:
    validator = MaintenancePlanValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    plan_id = uuid4()
    plan = SimpleNamespace(asset_id=asset_id, status="draft")
    with patch.object(validator._plans, "get", return_value=plan):
        with pytest.raises(MaintenancePlanValidationError, match="active maintenance plan"):
            validator.validate_plan_link_for_work_order(
                ctx, asset_id=asset_id, maintenance_plan_id=plan_id
            )
