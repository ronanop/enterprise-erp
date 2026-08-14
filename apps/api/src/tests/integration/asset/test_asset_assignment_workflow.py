"""Asset assignment workflow integration tests."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.service.assignment_service import AssignmentService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance
from tests.integration.asset.conftest import (
    count_wf_instances,
    insert_active_asset,
    seed_ast_assignment_approval,
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
        "modules.asset.service.assignment_service.asset_workflow_governance_enabled",
        return_value=True,
    )


def _silence_side_channels():
    return (
        patch(
            "modules.asset.service.governance_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.assignment_service.AuditService.log_entity_change",
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


def _insert_draft_assignment(db, ids, asset_id, *, employee_id=None) -> AstAssetAssignment:
    now = datetime.now(timezone.utc)
    emp = employee_id or uuid4()
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"AASN-TEST-{uuid4().hex[:8]}",
        asset_id=asset_id,
        allocation_type="employee",
        employee_id=emp,
        status="draft",
        delivery_reference_status="pending",
        delivery_reference_number="DC-TEST",
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
def test_int_asn_submit_creates_workflow_instance(wf_db, tenant_ids) -> None:
    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id)
    svc = AssignmentService(wf_db)
    ctx = _ctx(tenant_ids)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
    ):
        updated = svc.submit(ctx, assignment.id)

    assert updated.status == "submitted"
    assert updated.workflow_status == WorkflowStatus.IN_PROGRESS.value
    assert updated.workflow_instance_id is not None
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], assignment.id) == 1

    instance = wf_db.scalar(select(WfInstance).where(WfInstance.id == updated.workflow_instance_id))
    assert instance is not None
    assert instance.entity_name == "ast_asset_assignment"


@pytest.mark.integration
def test_int_asn_final_approval_activates_and_sets_custodian(wf_db, tenant_ids) -> None:
    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    employee_id = uuid4()
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id, employee_id=employee_id)
    svc = AssignmentService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
    ):
        svc.submit(creator_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        final = svc.approve(approver_ctx, assignment.id)

    assert final.status == "active"
    assert final.workflow_status == WorkflowStatus.APPROVED.value
    assert final.allocated_at is not None
    refreshed = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed is not None
    assert refreshed.custodian_employee_id == employee_id


@pytest.mark.integration
def test_int_asn_return_clears_matching_custodian(wf_db, tenant_ids) -> None:
    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    employee_id = uuid4()
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id, employee_id=employee_id)
    svc = AssignmentService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
        patch.object(svc._master, "update_master_asset_transfer", return_value=MagicMock()),
    ):
        svc.submit(creator_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        returned = svc.return_assignment(creator_ctx, assignment.id)

    assert returned.status == "returned"
    assert returned.returned_at is not None
    refreshed = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed is not None
    assert refreshed.custodian_employee_id is None


@pytest.mark.integration
def test_int_asn_approve_with_linked_master_audit_json_safe(wf_db, tenant_ids) -> None:
    """BUG-ASN-EMP-01: employee approve with master_asset_id must sync master without UUID JSON 500."""
    import json
    from uuid import UUID

    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    master_id = uuid4()
    asset.master_asset_id = master_id
    wf_db.flush()
    employee_id = uuid4()
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id, employee_id=employee_id)
    svc = AssignmentService(wf_db)
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
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
        patch.object(svc._master._assets, "get_asset", return_value=master_row),
        patch.object(svc._master._assets._repo, "update", return_value=master_row) as master_repo,
        patch.object(svc._master._assets._audit, "log_entity_change") as master_audit,
    ):
        svc.submit(creator_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        final = svc.approve(approver_ctx, assignment.id)

    assert final.status == "active"
    refreshed = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed is not None
    assert refreshed.custodian_employee_id == employee_id
    assert master_repo.call_args.kwargs["custodian_employee_id"] is employee_id
    assert isinstance(master_repo.call_args.kwargs["custodian_employee_id"], UUID)
    audit_value = master_audit.call_args.kwargs["new_value"]
    assert audit_value["custodian_employee_id"] == str(employee_id)
    json.dumps(audit_value)


@pytest.mark.integration
def test_int_asn_return_with_linked_master_clears_custodian_none(wf_db, tenant_ids) -> None:
    """Employee return clears master custodian with None through real update_asset audit path."""
    import json

    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    master_id = uuid4()
    asset.master_asset_id = master_id
    wf_db.flush()
    employee_id = uuid4()
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id, employee_id=employee_id)
    svc = AssignmentService(wf_db)
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
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
        patch.object(svc._master._assets, "get_asset", return_value=master_row),
        patch.object(svc._master._assets._repo, "update", return_value=master_row) as master_repo,
        patch.object(svc._master._assets._audit, "log_entity_change") as master_audit,
    ):
        svc.submit(creator_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        svc.approve(approver_ctx, assignment.id)
        returned = svc.return_assignment(creator_ctx, assignment.id)

    assert returned.status == "returned"
    refreshed = wf_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed is not None
    assert refreshed.custodian_employee_id is None
    # Final master sync on return clears custodian (None); approve also called update earlier.
    assert master_repo.call_args.kwargs["custodian_employee_id"] is None
    assert master_audit.call_args.kwargs["new_value"]["custodian_employee_id"] is None
    json.dumps(master_audit.call_args.kwargs["new_value"])


@pytest.mark.integration
def test_int_asn_reject_sets_cancelled(wf_db, tenant_ids) -> None:
    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id)
    svc = AssignmentService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
    ):
        svc.submit(creator_ctx, assignment.id)
        rejected = svc.reject(approver_ctx, assignment.id, comments="not needed")

    assert rejected.status == "cancelled"
    assert rejected.workflow_status == WorkflowStatus.REJECTED.value


@pytest.mark.integration
def test_int_asn_reopen_and_resubmit_creates_new_workflow_instance(wf_db, tenant_ids) -> None:
    seed_ast_assignment_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    assignment = _insert_draft_assignment(wf_db, tenant_ids, asset.id)
    svc = AssignmentService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._master, "get_employee", return_value=MagicMock()),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments, "find_pending_or_active_for_asset", return_value=None
        ),
    ):
        svc.submit(creator_ctx, assignment.id)
        first_instance_id = svc.get(creator_ctx, assignment.id).workflow_instance_id
        svc.reject(approver_ctx, assignment.id)
        reopened = svc.reopen(creator_ctx, assignment.id)
        assert reopened.status == "draft"
        assert reopened.workflow_instance_id is None
        assert reopened.workflow_status is None
        resubmitted = svc.resubmit(creator_ctx, assignment.id)
        second_instance_id = resubmitted.workflow_instance_id

    assert first_instance_id is not None
    assert second_instance_id is not None
    assert first_instance_id != second_instance_id
    assert resubmitted.status == "submitted"
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], assignment.id) == 2
