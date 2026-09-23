"""Asset maintenance workflow integration tests (FP-ASSET-004)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_service_history import AstAssetServiceHistory
from modules.asset.service.maintenance_service import MaintenanceService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from tests.integration.asset.conftest import (
    count_wf_instances,
    insert_active_asset,
    seed_ast_maintenance_approval,
)


def _ctx(ids: dict, *, as_approver: bool = False) -> TenantContext:
    return TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["approver_id"] if as_approver else ids["creator_id"],
        user_type="employee",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _enable_governance():
    return patch(
        "modules.asset.service.maintenance_service.asset_workflow_governance_enabled",
        return_value=True,
    )


def _silence_side_channels():
    return (
        patch(
            "modules.asset.service.governance_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.maintenance_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.foundation.service.workflow_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.governance_service.NotificationService.list_templates",
            return_value=[],
        ),
    )


def _insert_draft_maintenance(db, ids, asset_id) -> AstAssetMaintenance:
    now = datetime.now(timezone.utc)
    row = AstAssetMaintenance(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"AMNT-TEST-{uuid4().hex[:8]}",
        asset_id=asset_id,
        maintenance_type="preventive",
        status="draft",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["creator_id"],
        updated_by=ids["creator_id"],
    )
    db.add(row)
    db.flush()
    return row


@pytest.mark.integration
def test_int_mnt_submit_creates_workflow_instance(wf_db, tenant_ids) -> None:
    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    maintenance = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
    ):
        submitted = svc.submit(creator_ctx, maintenance.id)

    assert submitted.status == "submitted"
    assert submitted.workflow_instance_id is not None
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], maintenance.id) == 1


@pytest.mark.integration
def test_int_mnt_approve_schedule_start_complete_asset_status(wf_db, tenant_ids) -> None:
    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    maintenance = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
    ):
        svc.submit(creator_ctx, maintenance.id)
        # 2-step workflow: executive + manager — both as approver role in test
        svc.approve(approver_ctx, maintenance.id)
        approved = svc.approve(approver_ctx, maintenance.id)
        assert approved.status == "approved"
        scheduled = svc.schedule(approver_ctx, maintenance.id)
        assert scheduled.status == "scheduled"
        started = svc.start(approver_ctx, maintenance.id)
        assert started.status == "in_progress"
        wf_db.refresh(asset)
        assert asset.status == "in_maintenance"
        completed = svc.complete(approver_ctx, maintenance.id)
        assert completed.status == "completed"
        wf_db.refresh(asset)
        assert asset.status == "active"

    history = list(
        wf_db.scalars(
            select(AstAssetServiceHistory).where(
                AstAssetServiceHistory.maintenance_id == maintenance.id
            )
        ).all()
    )
    assert len(history) == 1


@pytest.mark.integration
def test_int_mnt_reject_reopen_resubmit(wf_db, tenant_ids) -> None:
    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    maintenance = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
    ):
        svc.submit(creator_ctx, maintenance.id)
        first_instance_id = svc.get(creator_ctx, maintenance.id).workflow_instance_id
        svc.reject(approver_ctx, maintenance.id)
        reopened = svc.reopen(creator_ctx, maintenance.id)
        assert reopened.status == "draft"
        assert reopened.workflow_instance_id is None
        resubmitted = svc.resubmit(creator_ctx, maintenance.id)
        second_instance_id = resubmitted.workflow_instance_id

    assert first_instance_id is not None
    assert second_instance_id is not None
    assert first_instance_id != second_instance_id
    assert resubmitted.status == "submitted"
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], maintenance.id) == 2


@pytest.mark.integration
def test_int_mnt_cancel_draft(wf_db, tenant_ids) -> None:
    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    maintenance = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        cancelled = svc.cancel_draft(creator_ctx, maintenance.id)
    assert cancelled.status == "cancelled"


@pytest.mark.integration
def test_int_mnt_open_work_order_exclusivity_blocks_second_create(wf_db, tenant_ids) -> None:
    from modules.asset.domain.exceptions import MaintenanceValidationError

    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    first = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._numbers, "generate", return_value=f"AMNT-TEST-{uuid4().hex[:8]}"),
    ):
        with pytest.raises(MaintenanceValidationError, match="open maintenance"):
            svc.create(
                creator_ctx,
                branch_id=tenant_ids["branch_id"],
                company_id=tenant_ids["company_id"],
                asset_id=asset.id,
                maintenance_type="corrective",
            )
    assert first.status == "draft"


@pytest.mark.integration
def test_int_mnt_reopen_blocked_when_another_open_exists(wf_db, tenant_ids) -> None:
    from modules.asset.domain.exceptions import MaintenanceValidationError

    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    first = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        svc.cancel_draft(creator_ctx, first.id)
        second = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
        assert second.status == "draft"
        first.workflow_status = WorkflowStatus.REJECTED.value
        wf_db.flush()
        with pytest.raises(MaintenanceValidationError, match="open maintenance"):
            svc.reopen(creator_ctx, first.id)


@pytest.mark.integration
def test_int_mnt_pending_transfer_blocks_start(wf_db, tenant_ids) -> None:
    from modules.asset.domain.exceptions import MaintenanceValidationError
    from modules.asset.models.asset_transfer import AstAssetTransfer

    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    maintenance = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    now = datetime.now(timezone.utc)
    pending_transfer = AstAssetTransfer(
        id=uuid4(),
        tenant_id=tenant_ids["tenant_id"],
        company_id=tenant_ids["company_id"],
        branch_id=tenant_ids["branch_id"],
        document_number=f"ATRF-TEST-{uuid4().hex[:8]}",
        asset_id=asset.id,
        from_branch_id=tenant_ids["branch_id"],
        to_branch_id=uuid4(),
        status="submitted",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=tenant_ids["creator_id"],
        updated_by=tenant_ids["creator_id"],
    )
    wf_db.add(pending_transfer)
    wf_db.flush()

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
    ):
        svc.submit(creator_ctx, maintenance.id)
        svc.approve(approver_ctx, maintenance.id)
        approved = svc.approve(approver_ctx, maintenance.id)
        assert approved.status == "approved"
        with pytest.raises(MaintenanceValidationError, match="pending transfer"):
            svc.start(approver_ctx, maintenance.id)
