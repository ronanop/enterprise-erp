"""Security tests for asset workflow governance (SoD)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import InvalidAssetWorkflowState, SegregationOfDutiesError
from modules.asset.service.asset_service import AssetService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.transfer_service import TransferService
from modules.foundation.domain.value_objects import TenantContext


def _ctx(user_id=None) -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=user_id or uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


@patch("modules.asset.service.asset_service.asset_workflow_governance_enabled", return_value=True)
def test_creator_cannot_approve_asset(_flag) -> None:
    db = MagicMock()
    svc = AssetService(db)
    user_id = uuid4()
    ctx = _ctx(user_id=user_id)
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(SegregationOfDutiesError):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.assignment_service.asset_workflow_governance_enabled", return_value=True)
def test_creator_cannot_approve_assignment(_flag) -> None:
    db = MagicMock()
    svc = AssignmentService(db)
    user_id = uuid4()
    ctx = _ctx(user_id=user_id)
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(SegregationOfDutiesError):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.assignment_service.asset_workflow_governance_enabled", return_value=True)
def test_assignment_approve_requires_workflow_instance(_flag) -> None:
    db = MagicMock()
    svc = AssignmentService(db)
    ctx = _ctx()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = None
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.asset_service.asset_workflow_governance_enabled", return_value=True)
def test_asset_approve_requires_workflow_instance(_flag) -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = None
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.asset_service.asset_workflow_governance_enabled", return_value=False)
def test_asset_reject_disabled_when_governance_off(_flag) -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    with pytest.raises(InvalidAssetWorkflowState):
        svc.reject(ctx, uuid4())


@patch("modules.asset.service.transfer_service.asset_workflow_governance_enabled", return_value=True)
def test_creator_cannot_approve_transfer(_flag) -> None:
    db = MagicMock()
    svc = TransferService(db)
    user_id = uuid4()
    ctx = _ctx(user_id=user_id)
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(SegregationOfDutiesError):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.transfer_service.asset_workflow_governance_enabled", return_value=True)
def test_transfer_approve_requires_workflow_instance(_flag) -> None:
    db = MagicMock()
    svc = TransferService(db)
    ctx = _ctx()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = None
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.transfer_service.asset_workflow_governance_enabled", return_value=False)
def test_transfer_reject_disabled_when_governance_off(_flag) -> None:
    db = MagicMock()
    svc = TransferService(db)
    ctx = _ctx()
    with pytest.raises(InvalidAssetWorkflowState):
        svc.reject(ctx, uuid4())


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=True)
def test_creator_cannot_approve_maintenance(_flag) -> None:
    from modules.asset.service.maintenance_service import MaintenanceService

    db = MagicMock()
    svc = MaintenanceService(db)
    user_id = uuid4()
    ctx = _ctx(user_id=user_id)
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(SegregationOfDutiesError):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=True)
def test_maintenance_approve_requires_workflow_instance(_flag) -> None:
    from modules.asset.service.maintenance_service import MaintenanceService

    db = MagicMock()
    svc = MaintenanceService(db)
    ctx = _ctx()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = None
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.approve(ctx, uuid4())


def test_maintenance_update_permission_is_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.maintenance:update" in codes


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_creator_cannot_approve_disposal(_flag) -> None:
    from modules.asset.service.disposal_service import DisposalService

    db = MagicMock()
    svc = DisposalService(db)
    user_id = uuid4()
    ctx = _ctx(user_id=user_id)
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(SegregationOfDutiesError):
            svc.approve(ctx, uuid4())


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_disposal_approve_requires_workflow_instance(_flag) -> None:
    from modules.asset.service.disposal_service import DisposalService

    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = None
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.approve(ctx, uuid4())


def test_disposal_update_permission_is_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.disposal:update" in codes


def test_depreciation_update_permission_is_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.depreciation:update" in codes


def test_depreciation_post_permission_is_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.depreciation:post" in codes
    assert "asset.depreciation:calculate" in codes


def test_revaluation_update_permission_is_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.revaluation:update" in codes


def test_asset_audit_update_permission_is_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.audit:update" in codes


def test_warranty_action_permissions_are_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.warranty:update" in codes
    assert "asset.warranty:activate" in codes
    assert "asset.warranty:extend" in codes
    assert "asset.warranty:expire" in codes


def test_insurance_action_permissions_are_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.insurance:update" in codes
    assert "asset.insurance:activate" in codes
    assert "asset.insurance:renew" in codes
    assert "asset.insurance:expire" in codes
    assert "asset.insurance:close" in codes


def test_maintenance_plan_permissions_are_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.maintenance_plan:read" in codes
    assert "asset.maintenance_plan:create" in codes
    assert "asset.maintenance_plan:update" in codes
    assert "asset.maintenance_plan:activate" in codes
    assert "asset.maintenance_plan:pause" in codes
    assert "asset.maintenance_plan:resume" in codes
    assert "asset.maintenance_plan:close" in codes


def test_location_permissions_are_catalogued() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.location:read" in codes
    assert "asset.location:create" in codes
    assert "asset.location:complete" in codes
    assert "asset.location:update" not in codes


def test_service_history_uses_maintenance_permissions_only() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.maintenance:read" in codes
    assert "asset.maintenance:create" in codes
    assert not any(code.startswith("asset.service_history:") for code in codes)


def test_checklist_permissions_seeded() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.checklist:read" in codes
    assert "asset.checklist:create" in codes
    assert "asset.checklist:update" in codes
    assert not any(code.startswith("asset.checklist:complete") for code in codes)


def test_meter_permissions_seeded() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.meter:read" in codes
    assert "asset.meter:create" in codes
    assert "asset.meter:update" in codes
    assert not any(code.startswith("asset.meter:void") for code in codes)


def test_document_permissions_seeded() -> None:
    from modules.asset.permissions import ASSET_PERMISSIONS

    codes = {p[0] for p in ASSET_PERMISSIONS}
    assert "asset.document:read" in codes
    assert "asset.document:create" in codes
    assert "asset.document:update" in codes
    assert not any(code.startswith("asset.document:supersede") for code in codes)
    assert not any(code.startswith("asset.document:archive") for code in codes)


@patch("modules.asset.service.revaluation_service.asset_workflow_governance_enabled", return_value=True)
def test_revaluation_sod_blocks_self_approve(_flag) -> None:
    from modules.asset.service.revaluation_service import RevaluationService

    user_id = uuid4()
    svc = RevaluationService(MagicMock())
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(SegregationOfDutiesError):
            svc.approve(_ctx(user_id=user_id), uuid4())
