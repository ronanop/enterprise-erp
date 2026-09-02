"""Unit tests — AssetExcelImportEngine (CR-004 Phase 8B)."""

from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.excel_import import (
    ExcelImportDefaults,
    ExcelImportRowInput,
    ExcelImportRowOutcome,
    ExcelImportSkipReason,
)
from modules.asset.domain.exceptions import DuplicateAssetRegistrationError
from modules.asset.service.excel_import_engine import AssetExcelImportEngine
from modules.foundation.domain.value_objects import TenantContext

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _defaults() -> ExcelImportDefaults:
    return ExcelImportDefaults(
        asset_category_id=uuid4(),
        asset_type="fixed",
        purchase_cost=Decimal("0"),
        currency_code="USD",
    )


def _row(**overrides) -> ExcelImportRowInput:
    base = dict(
        row_number=2,
        preview_status="valid",
        asset_tag="AST-100",
        asset_name="Dell Laptop",
        branch_id=uuid4(),
        operational_status=Ready,
        employee_id=None,
        department_id=None,
        asset_category_id=None,
        asset_type_id=uuid4(),
        serial_number=None,
    )
    base.update(overrides)
    return ExcelImportRowInput(**base)


def _engine():
    assets = MagicMock()
    assignments = MagicMock()
    operational = MagicMock()
    engine = AssetExcelImportEngine(
        MagicMock(),
        assets=assets,
        assignments=assignments,
        operational=operational,
    )
    return engine, assets, assignments, operational


def test_skips_invalid_preview_rows() -> None:
    engine, assets, _, _ = _engine()
    result = engine.import_row(
        _ctx(),
        _row(preview_status="invalid"),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.SKIPPED.value
    assert result.reason == ExcelImportSkipReason.INVALID_PREVIEW.value
    assets.create_for_import.assert_not_called()


def test_skips_error_preview_alias() -> None:
    engine, assets, _, _ = _engine()
    result = engine.import_row(
        _ctx(), _row(preview_status="error"), defaults=_defaults(), confirm_warnings=True
    )
    assert result.outcome == ExcelImportRowOutcome.SKIPPED.value
    assets.create_for_import.assert_not_called()


def test_skips_warning_without_confirmation() -> None:
    engine, assets, _, _ = _engine()
    result = engine.import_row(
        _ctx(),
        _row(preview_status="warning"),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.SKIPPED.value
    assert result.reason == ExcelImportSkipReason.WARNING_NOT_CONFIRMED.value
    assert result.warning is True
    assets.create_for_import.assert_not_called()


def test_imports_warning_when_confirmed() -> None:
    engine, assets, _, _ = _engine()
    asset_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    result = engine.import_row(
        _ctx(),
        _row(preview_status="warning", operational_status=Ready),
        defaults=_defaults(),
        confirm_warnings=True,
    )
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert result.warning is True
    assert result.operational_status == Ready


def test_duplicate_asset_tag_skips() -> None:
    engine, assets, _, _ = _engine()
    existing_id = uuid4()
    assets.find_by_asset_code.return_value = SimpleNamespace(id=existing_id)
    result = engine.import_row(_ctx(), _row(), defaults=_defaults(), confirm_warnings=False)
    assert result.outcome == ExcelImportRowOutcome.DUPLICATE.value
    assert result.reason == ExcelImportSkipReason.DUPLICATE_ASSET_TAG.value
    assert result.asset_id == existing_id
    assets.create_for_import.assert_not_called()


def test_duplicate_serial_skips() -> None:
    engine, assets, _, _ = _engine()
    existing_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = SimpleNamespace(id=existing_id)
    result = engine.import_row(
        _ctx(),
        _row(serial_number="SN-9"),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.DUPLICATE.value
    assert result.reason == ExcelImportSkipReason.DUPLICATE_SERIAL.value
    assets.create_for_import.assert_not_called()


def test_empty_asset_tag_imports_with_auto_code() -> None:
    engine, assets, _, _ = _engine()
    asset_id = uuid4()
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=2)
    result = engine.import_row(
        _ctx(), _row(asset_tag="  "), defaults=_defaults(), confirm_warnings=False
    )
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assets.create_for_import.assert_called_once()
    assert assets.create_for_import.call_args.kwargs["asset_code"] is None


def test_invalid_operational_status_fails() -> None:
    engine, assets, _, _ = _engine()
    result = engine.import_row(
        _ctx(),
        _row(operational_status="UNKNOWN"),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.FAILED.value
    assert "invalid_operational_status" in (result.reason or "")
    assets.create_for_import.assert_not_called()


def test_ready_to_move_create_submit_approve() -> None:
    engine, assets, assignments, operational = _engine()
    asset_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=2)
    result = engine.import_row(_ctx(), _row(), defaults=_defaults(), confirm_warnings=False)
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert result.asset_id == asset_id
    assert result.operational_status == Ready
    assets.create_for_import.assert_called_once()
    assets.submit.assert_called_once()
    assets.approve.assert_called_once()
    assignments.create.assert_not_called()
    operational.apply_action.assert_not_called()


def test_assigned_creates_employee_assignment_workflow() -> None:
    engine, assets, assignments, _ = _engine()
    asset_id = uuid4()
    assignment_id = uuid4()
    employee_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    assignments.create.return_value = SimpleNamespace(id=assignment_id)
    assignments.submit.return_value = SimpleNamespace(id=assignment_id)
    assignments.approve.return_value = SimpleNamespace(id=assignment_id)
    result = engine.import_row(
        _ctx(),
        _row(operational_status=Assigned, employee_id=employee_id),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert result.assignment_id == assignment_id
    assert result.operational_status == Assigned
    assignments.create.assert_called_once()
    assert assignments.create.call_args.kwargs["allocation_type"] == "employee"
    assert assignments.create.call_args.kwargs["employee_id"] == employee_id
    assignments.submit.assert_called_once()
    assignments.approve.assert_called_once()


def test_assigned_without_employee_fails() -> None:
    engine, assets, _, _ = _engine()
    asset_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    result = engine.import_row(
        _ctx(),
        _row(operational_status=Assigned, employee_id=None),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.FAILED.value
    assert "employee_id" in (result.reason or "")


def test_retired_via_employee_assign_and_return_outdated() -> None:
    engine, assets, assignments, _ = _engine()
    asset_id = uuid4()
    assignment_id = uuid4()
    employee_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    assignments.create.return_value = SimpleNamespace(id=assignment_id)
    assignments.submit.return_value = SimpleNamespace(id=assignment_id)
    assignments.approve.return_value = SimpleNamespace(id=assignment_id)
    result = engine.import_row(
        _ctx(),
        _row(operational_status=Retired, employee_id=employee_id),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert result.operational_status == Retired
    assignments.return_assignment.assert_called_once()
    assert assignments.return_assignment.call_args.kwargs["return_condition"] == "outdated"


def test_retired_without_employee_uses_branch_allocation() -> None:
    engine, assets, assignments, _ = _engine()
    asset_id = uuid4()
    assignment_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    assignments.create.return_value = SimpleNamespace(id=assignment_id)
    assignments.submit.return_value = SimpleNamespace(id=assignment_id)
    assignments.approve.return_value = SimpleNamespace(id=assignment_id)
    result = engine.import_row(
        _ctx(),
        _row(operational_status=Retired, employee_id=None),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert assignments.create.call_args.kwargs["allocation_type"] == "branch"


def test_pending_disposal_return_dead() -> None:
    engine, assets, assignments, _ = _engine()
    asset_id = uuid4()
    assignment_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    assignments.create.return_value = SimpleNamespace(id=assignment_id)
    assignments.submit.return_value = SimpleNamespace(id=assignment_id)
    assignments.approve.return_value = SimpleNamespace(id=assignment_id)
    result = engine.import_row(
        _ctx(),
        _row(operational_status=Pending),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert result.operational_status == Pending
    assert assignments.return_assignment.call_args.kwargs["return_condition"] == "dead"


def test_disposed_rejected_without_complete_disposal() -> None:
    engine, assets, assignments, operational = _engine()
    result = engine.import_row(
        _ctx(),
        _row(operational_status=Disposed),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.FAILED.value
    assert "DISPOSED cannot be assigned directly" in (result.reason or "")
    assets.create_for_import.assert_not_called()
    operational.apply_action.assert_not_called()
    assignments.return_assignment.assert_not_called()


def test_duplicate_registration_error_maps_to_duplicate() -> None:
    engine, assets, _, _ = _engine()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.side_effect = DuplicateAssetRegistrationError("dup")
    result = engine.import_row(_ctx(), _row(), defaults=_defaults(), confirm_warnings=False)
    assert result.outcome == ExcelImportRowOutcome.DUPLICATE.value


def test_unexpected_exception_maps_to_failed() -> None:
    engine, assets, _, _ = _engine()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.side_effect = RuntimeError("boom")
    result = engine.import_row(_ctx(), _row(), defaults=_defaults(), confirm_warnings=False)
    assert result.outcome == ExcelImportRowOutcome.FAILED.value
    assert "boom" in (result.reason or "")


def test_uses_row_category_over_defaults() -> None:
    engine, assets, _, _ = _engine()
    cat = uuid4()
    asset_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    engine.import_row(
        _ctx(),
        _row(asset_category_id=cat),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert assets.create_for_import.call_args.kwargs["asset_category_id"] == cat


def test_passes_serial_and_department() -> None:
    engine, assets, _, _ = _engine()
    asset_id = uuid4()
    dept = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    engine.import_row(
        _ctx(),
        _row(serial_number=" SN-1 ", department_id=dept),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    kwargs = assets.create_for_import.call_args.kwargs
    assert kwargs["serial_number"] == "SN-1"
    assert kwargs["department_id"] == dept


def test_delivery_fields_on_assignment() -> None:
    engine, assets, assignments, _ = _engine()
    asset_id = uuid4()
    assignment_id = uuid4()
    employee_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    assignments.create.return_value = SimpleNamespace(id=assignment_id)
    assignments.submit.return_value = SimpleNamespace(id=assignment_id)
    assignments.approve.return_value = SimpleNamespace(id=assignment_id)
    engine.import_row(
        _ctx(),
        _row(
            operational_status=Assigned,
            employee_id=employee_id,
            delivery_reference_number="DC-1",
            delivery_reference_status="issued",
            assignment_remarks="note",
        ),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    kwargs = assignments.create.call_args.kwargs
    assert kwargs["delivery_reference_number"] == "DC-1"
    assert kwargs["delivery_reference_status"] == "issued"
    assert kwargs["assignment_remarks"] == "note"


@pytest.mark.parametrize(
    "status",
    [Ready, Assigned, Retired, Pending],
)
def test_all_ops_statuses_accepted_as_targets(status: str) -> None:
    engine, assets, assignments, operational = _engine()
    asset_id = uuid4()
    assignment_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    assets.get.return_value = SimpleNamespace(id=asset_id, version=2)
    assignments.create.return_value = SimpleNamespace(id=assignment_id)
    assignments.submit.return_value = SimpleNamespace(id=assignment_id)
    assignments.approve.return_value = SimpleNamespace(id=assignment_id)
    row = _row(
        operational_status=status,
        employee_id=uuid4() if status == Assigned else None,
    )
    result = engine.import_row(_ctx(), row, defaults=_defaults(), confirm_warnings=False)
    assert result.outcome == ExcelImportRowOutcome.IMPORTED.value
    assert result.operational_status == status
    operational.apply_action.assert_not_called()


def test_never_calls_repo_directly() -> None:
    """Engine only talks to injected services (architecture guard)."""
    engine, assets, assignments, operational = _engine()
    assert not hasattr(engine, "_repo")
    assert engine._assets is assets
    assert engine._assignments is assignments
    assert engine._operational is operational


def test_create_for_import_receives_external_asset_code() -> None:
    engine, assets, _, _ = _engine()
    asset_id = uuid4()
    assets.find_by_asset_code.return_value = None
    assets.find_by_serial_number.return_value = None
    assets.create_for_import.return_value = SimpleNamespace(id=asset_id)
    assets.submit.return_value = SimpleNamespace(id=asset_id)
    assets.approve.return_value = SimpleNamespace(id=asset_id, version=1)
    engine.import_row(
        _ctx(),
        _row(asset_tag=" TAG-9 "),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert assets.create_for_import.call_args.kwargs["asset_code"] == "TAG-9"


def test_case_insensitive_preview_status() -> None:
    engine, assets, _, _ = _engine()
    result = engine.import_row(
        _ctx(),
        _row(preview_status="INVALID"),
        defaults=_defaults(),
        confirm_warnings=False,
    )
    assert result.outcome == ExcelImportRowOutcome.SKIPPED.value
    assets.create_for_import.assert_not_called()
