"""TransferValidator unit tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import NotFoundException
from modules.asset.domain.exceptions import TransferValidationError
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


def _asset(company_id):
    return SimpleNamespace(
        id=uuid4(),
        company_id=company_id,
        branch_id=uuid4(),
        status="active",
        operational_status="READY_TO_MOVE",
        department_id=uuid4(),
        custodian_employee_id=uuid4(),
    )


def test_create_requires_asset() -> None:
    validator = TransferValidator(MagicMock())
    with pytest.raises(TransferValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_rejects_ineligible_asset_status() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    asset.status = "draft"
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(TransferValidationError, match="active"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "to_branch_id": uuid4()},
            )


def test_create_requires_target() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        pytest.raises(TransferValidationError, match="target"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id},
        )


def test_create_rejects_pending_transfer() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    pending = SimpleNamespace(document_number="ATRF-2026-000001")
    branch = SimpleNamespace(company_id=ctx.company_id)
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._org, "get_branch", return_value=branch),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=pending),
        pytest.raises(TransferValidationError, match="pending transfer"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "to_branch_id": uuid4()},
        )


def test_create_validates_destination_branch_company() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    branch = SimpleNamespace(company_id=uuid4())
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._org, "get_branch", return_value=branch),
        pytest.raises(TransferValidationError, match="Destination branch"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "to_branch_id": uuid4()},
        )


def test_create_validates_department_and_employee_targets() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._org, "get_department", side_effect=NotFoundException("Department not found")),
        pytest.raises(NotFoundException, match="Department"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "to_department_id": uuid4()},
        )


def test_submit_requires_actual_change() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    shared_location_id = uuid4()
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        company_id=ctx.company_id,
        status="draft",
        from_branch_id=asset.branch_id,
        to_branch_id=asset.branch_id,
        from_department_id=asset.department_id,
        to_department_id=asset.department_id,
        from_employee_id=asset.custodian_employee_id,
        to_employee_id=asset.custodian_employee_id,
        from_location_label="A",
        to_location_label="A",
        from_org_location_id=shared_location_id,
        to_org_location_id=shared_location_id,
    )
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._assignments, "find_pending_or_active_for_asset", return_value=None),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        pytest.raises(TransferValidationError, match="must differ"),
    ):
        validator.validate_submit_readiness(ctx, row)


def test_update_rejects_non_draft() -> None:
    validator = TransferValidator(MagicMock())
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=uuid4(),
        status="submitted",
        document_number="ATRF-1",
        to_branch_id=None,
        to_department_id=None,
        to_employee_id=None,
        to_location_label=None,
        to_org_location_id=None,
    )
    with pytest.raises(TransferValidationError, match="draft transfers"):
        validator.validate_update_fields(_ctx(), row, {"to_branch_id": uuid4()})


def test_execute_readiness_requires_submitted_status() -> None:
    validator = TransferValidator(MagicMock())
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=uuid4(),
        status="draft",
        to_branch_id=uuid4(),
        to_department_id=None,
        to_employee_id=None,
        to_location_label=None,
        to_org_location_id=None,
    )
    with pytest.raises(TransferValidationError, match="submitted"):
        validator.validate_execute_readiness(_ctx(), row)


@pytest.mark.parametrize("ops", ["RETIRED", "PENDING_DISPOSAL", "DISPOSED"])
def test_create_blocks_retired_pending_disposed_ops(ops: str) -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    asset.operational_status = ops
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(TransferValidationError, match="cannot be transferred"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "to_branch_id": uuid4()},
            )


def test_create_blocks_open_assignment() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(
            validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=SimpleNamespace(document_number="AASN-1"),
        ),
        pytest.raises(TransferValidationError, match="currently assigned"),
    ):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "to_branch_id": uuid4()},
        )
