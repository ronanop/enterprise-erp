"""AssignmentValidator unit tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import AssignmentValidationError
from modules.asset.service.assignment_validator import AssignmentValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _asset(
    company_id,
    *,
    is_shared: bool = False,
    operational_status: str | None = "READY_TO_MOVE",
):
    return SimpleNamespace(
        id=uuid4(),
        company_id=company_id,
        branch_id=uuid4(),
        status="active",
        operational_status=operational_status,
        is_shared=is_shared,
    )


def test_create_requires_employee_for_employee_type() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._transfers, "find_pending_for_asset", return_value=None):
            with patch.object(
                validator._assignments, "find_pending_or_active_for_asset", return_value=None
            ):
                with pytest.raises(AssignmentValidationError, match="employee_id"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={"asset_id": asset.id, "allocation_type": "employee"},
                    )


def test_create_blocks_exclusive_when_not_shared() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id, is_shared=False)
    pending = SimpleNamespace(document_number="AASN-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._master, "get_employee", return_value=MagicMock()):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    validator._assignments,
                    "find_pending_or_active_for_asset",
                    return_value=pending,
                ):
                    with pytest.raises(AssignmentValidationError, match="pending or active"):
                        validator.validate_create_fields(
                            ctx,
                            company_id=ctx.company_id,
                            fields={
                                "asset_id": asset.id,
                                "allocation_type": "employee",
                                "employee_id": uuid4(),
                            },
                        )


def test_create_blocks_pending_transfer() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id, is_shared=True)
    transfer = SimpleNamespace(document_number="ATRF-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._master, "get_employee", return_value=MagicMock()):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=transfer):
                with pytest.raises(AssignmentValidationError, match="pending transfer"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset.id,
                            "allocation_type": "employee",
                            "employee_id": uuid4(),
                        },
                    )


def test_activate_requires_submitted() -> None:
    validator = AssignmentValidator(MagicMock())
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        company_id=uuid4(),
        status="draft",
        allocation_type="employee",
        employee_id=uuid4(),
        department_id=None,
        project_id=None,
    )
    with pytest.raises(AssignmentValidationError, match="submitted"):
        validator.validate_activate_readiness(_ctx(), row)


@pytest.mark.parametrize(
    ("ops", "match"),
    [
        ("ASSIGNED", "already assigned"),
        ("RETIRED", "Retired assets"),
        ("PENDING_DISPOSAL", "pending disposal"),
        ("DISPOSED", "Disposed assets"),
        (None, "not ready to move"),
    ],
)
def test_create_blocks_non_ready_operational_status(ops: str | None, match: str) -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id, is_shared=True, operational_status=ops)
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._master, "get_employee", return_value=MagicMock()):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    validator._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    with pytest.raises(AssignmentValidationError, match=match):
                        validator.validate_create_fields(
                            ctx,
                            company_id=ctx.company_id,
                            fields={
                                "asset_id": asset.id,
                                "allocation_type": "employee",
                                "employee_id": uuid4(),
                            },
                        )


def test_create_allows_ready_to_move() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id, is_shared=True, operational_status="READY_TO_MOVE")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._master, "get_employee", return_value=MagicMock()):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    validator._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    result = validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset.id,
                            "allocation_type": "employee",
                            "employee_id": uuid4(),
                            "delivery_reference_status": "pending",
                        },
                    )
    assert result["delivery_reference_status"] == "pending"


def test_activate_blocks_when_ops_changed_to_assigned() -> None:
    """Race: draft created while READY; activate after another assignment."""
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id, is_shared=True, operational_status="ASSIGNED")
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        company_id=ctx.company_id,
        status="submitted",
        allocation_type="employee",
        employee_id=uuid4(),
        department_id=None,
        project_id=None,
        delivery_reference_number="DC-1",
        delivery_reference_status="issued",
        delivery_challan_signature_status="not_signed",
        assignment_remarks="ok",
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._master, "get_employee", return_value=MagicMock()):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    validator._assignments, "find_pending_or_active_for_asset", return_value=None
                ):
                    with pytest.raises(AssignmentValidationError, match="already assigned"):
                        validator.validate_activate_readiness(ctx, row)
