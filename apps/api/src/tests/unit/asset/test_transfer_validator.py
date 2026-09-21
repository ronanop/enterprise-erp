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
        patch.object(validator._maintenances, "find_open_for_asset", return_value=None),
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


def test_user_transfer_rejects_ready_to_move() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    asset.operational_status = "READY_TO_MOVE"
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(TransferValidationError, match="Only assigned assets"):
            validator.validate_user_transfer_eligibility(ctx, asset.id)


def test_user_transfer_rejects_missing_active_assignment() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    asset.operational_status = "ASSIGNED"
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(
            validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=None,
        ),
        pytest.raises(TransferValidationError, match="active assignment"),
    ):
        validator.validate_user_transfer_eligibility(ctx, asset.id)


def test_user_transfer_accepts_assigned_with_active_assignment() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = _asset(ctx.company_id)
    asset.operational_status = "ASSIGNED"
    assignment = SimpleNamespace(
        id=uuid4(),
        status="active",
        document_number="AASN-1",
        employee_id=uuid4(),
    )
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(
            validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=assignment,
        ),
        patch.object(validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(validator._maintenances, "find_open_for_asset", return_value=None),
    ):
        got_asset, got_asn = validator.validate_user_transfer_eligibility(ctx, asset.id)
    assert got_asset is asset
    assert got_asn is assignment


def test_user_transfer_rejects_missing_asset() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    with (
        patch.object(validator._assets, "get", return_value=None),
        pytest.raises(NotFoundException, match="Asset not found"),
    ):
        validator.validate_user_transfer_eligibility(ctx, uuid4())


def test_user_transfer_verification_requires_backup_and_qc() -> None:
    validator = TransferValidator(MagicMock())
    with pytest.raises(TransferValidationError, match="data backup"):
        validator.validate_user_transfer_verification(
            data_backup_verified=False,
            qc_completed=True,
            physical_condition="good",
            verified_component_ids=[],
            issued_component_ids=[],
            asset_version=1,
            current_asset_version=1,
        )
    with pytest.raises(TransferValidationError, match="QC testing"):
        validator.validate_user_transfer_verification(
            data_backup_verified=True,
            qc_completed=False,
            physical_condition="good",
            verified_component_ids=[],
            issued_component_ids=[],
            asset_version=1,
            current_asset_version=1,
        )


def test_user_transfer_verification_requires_condition() -> None:
    validator = TransferValidator(MagicMock())
    with pytest.raises(TransferValidationError, match="physical_condition"):
        validator.validate_user_transfer_verification(
            data_backup_verified=True,
            qc_completed=True,
            physical_condition="",
            verified_component_ids=[],
            issued_component_ids=[],
            asset_version=1,
            current_asset_version=1,
        )


def test_user_transfer_verification_requires_all_issued_components() -> None:
    validator = TransferValidator(MagicMock())
    c1, c2 = uuid4(), uuid4()
    with pytest.raises(TransferValidationError, match="All issued components"):
        validator.validate_user_transfer_verification(
            data_backup_verified=True,
            qc_completed=True,
            physical_condition="good",
            verified_component_ids=[c1],
            issued_component_ids=[c1, c2],
            asset_version=1,
            current_asset_version=1,
        )


def test_user_transfer_verification_allows_empty_components() -> None:
    validator = TransferValidator(MagicMock())
    condition = validator.validate_user_transfer_verification(
        data_backup_verified=True,
        qc_completed=True,
        physical_condition="outdated",
        verified_component_ids=[],
        issued_component_ids=[],
        asset_version=1,
        current_asset_version=1,
    )
    assert condition == "outdated"


def test_user_transfer_assign_requires_good_physical_condition() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    with pytest.raises(TransferValidationError, match="Good"):
        validator.validate_user_transfer_assign_request(
            ctx,
            company_id=ctx.company_id,
            employee_source="MASTER_DATA",
            employee_id=uuid4(),
            manual_employee_name=None,
            manual_employee_phone=None,
            manual_employee_email=None,
            manual_employee_deployed_to=None,
            department_id=uuid4(),
            to_location_id=uuid4(),
            to_building_id=uuid4(),
            physical_condition="dead",
            previous_employee_id=uuid4(),
        )


def test_user_transfer_assign_manual_entry_requires_manual_fields() -> None:
    validator = TransferValidator(MagicMock())
    validator._org = MagicMock()
    validator._org.get_department.return_value = SimpleNamespace(company_id=None)
    ctx = _ctx()
    with pytest.raises(TransferValidationError, match="manual_employee"):
        validator.validate_user_transfer_assign_request(
            ctx,
            company_id=ctx.company_id,
            employee_source="MANUAL_ENTRY",
            employee_id=None,
            manual_employee_name="Shreya",
            manual_employee_phone=None,
            manual_employee_email=None,
            manual_employee_deployed_to="Site",
            department_id=uuid4(),
            to_location_id=uuid4(),
            to_building_id=uuid4(),
            physical_condition="good",
            previous_employee_id=None,
        )


def test_user_transfer_assign_manual_entry_accepts_valid_payload() -> None:
    validator = TransferValidator(MagicMock())
    dept_id = uuid4()
    validator._org = MagicMock()
    validator._org.get_department.return_value = SimpleNamespace(company_id=None)
    ctx = _ctx()
    resolved = validator.validate_user_transfer_assign_request(
        ctx,
        company_id=ctx.company_id,
        employee_source="MANUAL_ENTRY",
        employee_id=None,
        manual_employee_name="Shreya Saxena",
        manual_employee_phone="9876543210",
        manual_employee_email=None,
        manual_employee_deployed_to="Client site",
        department_id=dept_id,
        to_location_id=uuid4(),
        to_building_id=uuid4(),
        physical_condition="good",
        previous_employee_id=None,
    )
    assert resolved == dept_id


def test_user_transfer_return_requires_reason() -> None:
    validator = TransferValidator(MagicMock())
    with pytest.raises(TransferValidationError, match="reason"):
        validator.validate_user_transfer_return_request(reason="   ")


def test_user_transfer_verification_rejects_stale_asset_version() -> None:
    validator = TransferValidator(MagicMock())
    with pytest.raises(TransferValidationError, match="updated while verification"):
        validator.validate_user_transfer_verification(
            data_backup_verified=True,
            qc_completed=True,
            physical_condition="good",
            verified_component_ids=[],
            issued_component_ids=[],
            asset_version=1,
            current_asset_version=2,
        )
