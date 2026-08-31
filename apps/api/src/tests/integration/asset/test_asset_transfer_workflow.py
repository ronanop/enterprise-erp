"""Asset transfer workflow integration tests."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from core.exceptions import NotFoundException
from modules.asset.domain.exceptions import TransferValidationError
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
    insert_draft_asset,
    seed_ast_transfer_approval,
)


def _create_patches(svc: TransferService, *, company_id):
    """Document numbers + audit + destination branch org lookup for create()."""
    return (
        patch.object(svc._numbers, "generate", return_value=f"ATRF-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change"),
        patch.object(
            svc._validator._org,
            "get_branch",
            return_value=SimpleNamespace(company_id=company_id),
        ),
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


@pytest.mark.integration
def test_int_trf_linked_master_update_asset_audit_json_safe(wf_db, tenant_ids) -> None:
    """Linked-master transfer must not UUID-serialize when updating master via real update_asset."""
    import json
    from uuid import UUID

    seed_ast_transfer_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    master_id = uuid4()
    asset.master_asset_id = master_id
    wf_db.flush()
    transfer = _insert_draft_transfer(wf_db, tenant_ids, asset.id, asset.branch_id)
    svc = TransferService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)
    master_row = MagicMock(
        id=master_id, company_id=tenant_ids["company_id"], branch_id=tenant_ids["branch_id"]
    )

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._master._assets, "get_asset", return_value=master_row),
        patch.object(svc._master._assets._scope, "validate_branch_access"),
        patch.object(svc._master._assets._repo, "update", return_value=master_row) as master_repo,
        patch.object(svc._master._assets._audit, "log_entity_change") as master_audit,
    ):
        svc.submit(creator_ctx, transfer.id)
        svc.approve(approver_ctx, transfer.id)
        svc.approve(approver_ctx, transfer.id)
        svc.approve(approver_ctx, transfer.id)

    assert master_repo.called
    repo_kwargs = master_repo.call_args.kwargs
    if "branch_id" in repo_kwargs and repo_kwargs["branch_id"] is not None:
        assert isinstance(repo_kwargs["branch_id"], UUID)
    audit_value = master_audit.call_args.kwargs["new_value"]
    for key in ("branch_id", "custodian_employee_id", "location_id"):
        if key in audit_value and audit_value[key] is not None:
            assert isinstance(audit_value[key], str)
    json.dumps(audit_value)


@pytest.mark.integration
def test_int_trf_create_draft_cross_branch_persists_targets(wf_db, tenant_ids) -> None:
    """BUG-TRF-CREATE-01: create with asset_id in fields must not 500 / TypeError."""
    asset = insert_active_asset(wf_db, tenant_ids)
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    to_branch_id = uuid4()
    asset_before = (
        asset.version,
        asset.status,
        asset.operational_status,
        asset.branch_id,
    )

    patches = _create_patches(svc, company_id=tenant_ids["company_id"])
    with patches[0], patches[1] as mock_audit, patches[2]:
        row = svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=tenant_ids["company_id"],
            asset_id=asset.id,
            to_branch_id=to_branch_id,
            to_location_label="Dest Lab",
            reason="Office move",
            transfer_notes="note",
        )

    assert row.status == "draft"
    assert row.asset_id == asset.id
    assert row.company_id == tenant_ids["company_id"]
    assert row.to_branch_id == to_branch_id
    assert row.to_location_label == "Dest Lab"
    assert row.reason == "Office move"
    assert row.transfer_notes == "note"
    assert mock_audit.called
    assert mock_audit.call_args.kwargs["operation"] == "create"

    rows = list(
        wf_db.scalars(
            select(AstAssetTransfer).where(
                AstAssetTransfer.asset_id == asset.id,
                AstAssetTransfer.is_deleted.is_(False),
            )
        ).all()
    )
    assert len(rows) == 1
    refreshed = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert (
        refreshed.version,
        refreshed.status,
        refreshed.operational_status,
        refreshed.branch_id,
    ) == asset_before


@pytest.mark.integration
def test_int_trf_create_same_branch_location_only(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    patches = _create_patches(svc, company_id=tenant_ids["company_id"])
    with patches[0], patches[1], patches[2]:
        row = svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=tenant_ids["company_id"],
            asset_id=asset.id,
            to_branch_id=asset.branch_id,
            to_location_label="Same-branch dest",
        )
    assert row.status == "draft"
    assert row.to_branch_id == asset.branch_id
    assert row.to_location_label == "Same-branch dest"


@pytest.mark.integration
def test_int_trf_create_rejects_invalid_asset(wf_db, tenant_ids) -> None:
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    patches = _create_patches(svc, company_id=tenant_ids["company_id"])
    with patches[0], patches[1], patches[2], pytest.raises(NotFoundException):
        svc.create(
            ctx,
            branch_id=tenant_ids["branch_id"],
            company_id=tenant_ids["company_id"],
            asset_id=uuid4(),
            to_location_label="Dest",
        )


@pytest.mark.integration
def test_int_trf_create_rejects_cross_tenant_asset(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.tenant_id = uuid4()
    wf_db.flush()
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    patches = _create_patches(svc, company_id=tenant_ids["company_id"])
    with patches[0], patches[1], patches[2], pytest.raises(NotFoundException):
        svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=tenant_ids["company_id"],
            asset_id=asset.id,
            to_location_label="Dest",
        )


@pytest.mark.integration
def test_int_trf_create_rejects_non_transferable_asset(wf_db, tenant_ids) -> None:
    asset = insert_draft_asset(wf_db, tenant_ids)
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    patches = _create_patches(svc, company_id=tenant_ids["company_id"])
    with patches[0], patches[1], patches[2], pytest.raises(TransferValidationError, match="active"):
        svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=tenant_ids["company_id"],
            asset_id=asset.id,
            to_location_label="Dest",
        )


@pytest.mark.integration
def test_int_trf_create_rejects_missing_destination(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    svc = TransferService(wf_db)
    ctx = _ctx(tenant_ids)
    patches = _create_patches(svc, company_id=tenant_ids["company_id"])
    with patches[0], patches[1], patches[2], pytest.raises(TransferValidationError, match="target"):
        svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=tenant_ids["company_id"],
            asset_id=asset.id,
        )