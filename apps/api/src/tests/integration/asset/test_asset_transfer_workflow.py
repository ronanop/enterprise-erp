"""Asset transfer workflow integration tests."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_location import AstAssetLocation
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.service.transfer_service import TransferService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance
from tests.integration.asset.conftest import (
    count_wf_instances,
    insert_active_asset,
    seed_ast_transfer_approval,
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
        "modules.asset.service.transfer_service.asset_workflow_governance_enabled",
        return_value=True,
    )


def _silence_side_channels():
    return (
        patch(
            "modules.asset.service.governance_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.transfer_service.AuditService.log_entity_change",
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


def _insert_draft_transfer(db, ids, asset_id, from_branch_id) -> AstAssetTransfer:
    now = datetime.now(timezone.utc)
    row = AstAssetTransfer(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"ATRF-TEST-{uuid4().hex[:8]}",
        asset_id=asset_id,
        from_branch_id=from_branch_id,
        to_branch_id=uuid4(),
        status="draft",
        reason="Office move",
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


def _insert_current_location(db, ids, asset_id, branch_id) -> None:
    now = datetime.now(timezone.utc)
    db.add(
        AstAssetLocation(
            id=uuid4(),
            tenant_id=ids["tenant_id"],
            company_id=ids["company_id"],
            branch_id=branch_id,
            asset_id=asset_id,
            location_label="Old Location",
            org_location_id=None,
            effective_from=now,
            is_current=True,
            status="active",
            is_deleted=False,
            version=1,
            created_at=now,
            updated_at=now,
            created_by=ids["creator_id"],
            updated_by=ids["creator_id"],
        )
    )
    db.flush()


@pytest.mark.integration
def test_int_trf_submit_creates_workflow_instance(wf_db, tenant_ids) -> None:
    seed_ast_transfer_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    transfer = _insert_draft_transfer(wf_db, tenant_ids, asset.id, asset.branch_id)
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        updated = svc.submit(ctx, transfer.id)

    assert updated.status == "submitted"
    assert updated.workflow_status == WorkflowStatus.IN_PROGRESS.value
    assert updated.workflow_instance_id is not None
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], transfer.id) == 1

    instance = wf_db.scalar(select(WfInstance).where(WfInstance.id == updated.workflow_instance_id))
    assert instance is not None
    assert instance.entity_name == "ast_asset_transfer"


@pytest.mark.integration
def test_int_trf_final_approval_executes_transfer_and_location_history(wf_db, tenant_ids) -> None:
    seed_ast_transfer_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    _insert_current_location(wf_db, tenant_ids, asset.id, asset.branch_id)
    transfer = _insert_draft_transfer(wf_db, tenant_ids, asset.id, asset.branch_id)
    transfer.to_location_label = "New Location"
    svc = TransferService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        svc.submit(creator_ctx, transfer.id)
        after_1 = svc.approve(approver_ctx, transfer.id)
        assert after_1.status == "submitted"
        assert after_1.workflow_status == WorkflowStatus.IN_PROGRESS.value
        after_2 = svc.approve(approver_ctx, transfer.id)
        assert after_2.status == "submitted"
        assert after_2.workflow_status == WorkflowStatus.IN_PROGRESS.value
        final = svc.approve(approver_ctx, transfer.id)

    assert final.status == "completed"
    assert final.workflow_status == WorkflowStatus.APPROVED.value
    refreshed_asset = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed_asset is not None
    assert refreshed_asset.branch_id == transfer.to_branch_id
    locations = svc._locations.list_rows(creator_ctx, tenant_ids["company_id"])
    assert len([loc for loc in locations if loc.asset_id == asset.id and loc.is_current]) == 1
    assert len([loc for loc in locations if loc.asset_id == asset.id and not loc.is_current]) == 1


@pytest.mark.integration
def test_int_trf_reject_sets_cancelled_and_workflow_rejected(wf_db, tenant_ids) -> None:
    seed_ast_transfer_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    transfer = _insert_draft_transfer(wf_db, tenant_ids, asset.id, asset.branch_id)
    svc = TransferService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        svc.submit(creator_ctx, transfer.id)
        rejected = svc.reject(approver_ctx, transfer.id, comments="not required")

    assert rejected.status == "cancelled"
    assert rejected.workflow_status == WorkflowStatus.REJECTED.value


@pytest.mark.integration
def test_int_trf_resubmit_creates_second_workflow_instance(wf_db, tenant_ids) -> None:
    seed_ast_transfer_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    transfer = _insert_draft_transfer(wf_db, tenant_ids, asset.id, asset.branch_id)
    svc = TransferService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        svc.submit(creator_ctx, transfer.id)
        first_instance_id = svc.get(creator_ctx, transfer.id).workflow_instance_id
        svc.reject(approver_ctx, transfer.id)
        svc.resubmit(creator_ctx, transfer.id)
        second_instance_id = svc.get(creator_ctx, transfer.id).workflow_instance_id

    assert first_instance_id is not None
    assert second_instance_id is not None
    assert first_instance_id != second_instance_id


@pytest.mark.integration
def test_int_trf_execute_updates_master_asset_when_linked(wf_db, tenant_ids) -> None:
    seed_ast_transfer_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.master_asset_id = uuid4()
    transfer = _insert_draft_transfer(wf_db, tenant_ids, asset.id, asset.branch_id)
    svc = TransferService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._master, "update_master_asset_transfer", return_value=MagicMock()) as mock_master,
    ):
        svc.submit(creator_ctx, transfer.id)
        svc.approve(approver_ctx, transfer.id)
        svc.approve(approver_ctx, transfer.id)
        svc.approve(approver_ctx, transfer.id)

    mock_master.assert_called_once()
