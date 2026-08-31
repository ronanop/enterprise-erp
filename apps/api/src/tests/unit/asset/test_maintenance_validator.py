"""Unit tests for MaintenanceValidator (FP-ASSET-004)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import MaintenanceValidationError
from modules.asset.service.maintenance_validator import MaintenanceValidator
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
    validator = MaintenanceValidator(MagicMock())
    with pytest.raises(MaintenanceValidationError, match="asset_id is required"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_blocks_disposed_asset() -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MaintenanceValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "maintenance_type": "preventive"},
            )


def test_create_blocks_second_open_work_order() -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        operational_status="READY_TO_MOVE",
    )
    open_wo = SimpleNamespace(document_number="AMNT-2026-000001")
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._maintenances, "find_open_for_asset", return_value=open_wo),
        pytest.raises(MaintenanceValidationError, match="open maintenance"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "maintenance_type": "corrective"},
        )


@pytest.mark.parametrize("ops", ["RETIRED", "PENDING_DISPOSAL", "DISPOSED"])
def test_create_blocks_retired_pending_disposed_ops(ops: str) -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        operational_status=ops,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(MaintenanceValidationError, match="cannot enter maintenance"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "maintenance_type": "preventive"},
            )


def test_create_blocks_open_assignment() -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        operational_status="READY_TO_MOVE",
    )
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(
            validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=SimpleNamespace(document_number="AASN-1"),
        ),
        pytest.raises(MaintenanceValidationError, match="currently assigned"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "maintenance_type": "preventive"},
        )


def test_start_blocks_pending_transfer() -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        status="approved",
        asset_id=uuid4(),
    )
    asset = SimpleNamespace(
        id=row.asset_id, status="active", operational_status="READY_TO_MOVE"
    )
    pending = SimpleNamespace(document_number="ATRF-2026-000001")
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=pending),
        pytest.raises(MaintenanceValidationError, match="pending transfer"),
    ):
        validator.validate_start_readiness(ctx, row)


def test_update_only_draft() -> None:
    validator = MaintenanceValidator(MagicMock())
    row = SimpleNamespace(status="submitted", asset_id=uuid4())
    with pytest.raises(MaintenanceValidationError, match="Only draft"):
        validator.validate_update_fields(_ctx(), row, {"maintenance_type": "emergency"})


def test_reopen_blocked_when_another_open_work_order_exists() -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(id=uuid4(), asset_id=uuid4(), status="cancelled")
    other = SimpleNamespace(document_number="AMNT-2026-000099")
    with patch.object(validator._maintenances, "find_open_for_asset", return_value=other):
        with pytest.raises(MaintenanceValidationError, match="open maintenance"):
            validator.validate_reopen_readiness(ctx, row)
