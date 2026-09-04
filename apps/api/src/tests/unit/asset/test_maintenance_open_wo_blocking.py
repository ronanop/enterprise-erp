"""Unit tests for open-maintenance blocking on assignment and transfer."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import AssignmentValidationError, TransferValidationError
from modules.asset.service.assignment_validator import AssignmentValidator
from modules.asset.service.transfer_validator import TransferValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_assignment_blocks_open_maintenance_work_order() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        status="active",
        operational_status="READY_TO_MOVE",
        is_shared=False,
    )
    open_wo = SimpleNamespace(document_number="AMNT-2026-000099")
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(validator._maintenances, "find_open_for_asset", return_value=open_wo),
        pytest.raises(AssignmentValidationError, match="open maintenance"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset_id, "allocation_type": "employee", "employee_id": uuid4()},
        )


def test_transfer_blocks_open_maintenance_work_order() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        status="active",
        operational_status="READY_TO_MOVE",
        branch_id=uuid4(),
        department_id=None,
        employee_id=None,
        location_label=None,
        org_location_id=None,
    )
    open_wo = SimpleNamespace(document_number="AMNT-2026-000100")
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(validator._maintenances, "find_open_for_asset", return_value=open_wo),
        patch.object(validator._org, "get_branch", return_value=SimpleNamespace(company_id=ctx.company_id)),
        pytest.raises(TransferValidationError, match="open maintenance"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={
                "asset_id": asset_id,
                "to_branch_id": uuid4(),
            },
        )
