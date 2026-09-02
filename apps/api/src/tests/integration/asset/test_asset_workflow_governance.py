"""INT-WF-01 / INT-WF-02 / INT-WF-06 — asset workflow governance (real WorkflowService)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance
from sqlalchemy import select

from tests.integration.asset.conftest import (
    count_wf_instances,
    insert_draft_asset,
    seed_ast_asset_approval,
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
        "modules.asset.service.asset_service.asset_workflow_governance_enabled",
        return_value=True,
    )


def _silence_side_channels():
    """Audit/notification persistence is out of scope for WF path verification."""
    return (
        patch(
            "modules.asset.service.governance_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.asset_service.AuditService.log_entity_change",
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


@pytest.mark.integration
def test_int_wf_01_submit_creates_workflow_instance(wf_db, tenant_ids) -> None:
    """INT-WF-01: submit creates wf_instance and sets workflow fields."""
    seed_ast_asset_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_draft_asset(wf_db, tenant_ids)
    svc = AssetService(wf_db)
    ctx = _ctx(tenant_ids)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        updated = svc.submit(ctx, asset.id)

    assert updated.status == "submitted"
    assert updated.workflow_status == WorkflowStatus.IN_PROGRESS.value
    assert updated.workflow_instance_id is not None
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], asset.id) == 1

    instance = wf_db.scalar(
        select(WfInstance).where(WfInstance.id == updated.workflow_instance_id)
    )
    assert instance is not None
    assert instance.entity_name == "ast_asset"
    assert instance.entity_id == asset.id
    assert instance.status in {
        WorkflowStatus.PENDING.value,
        WorkflowStatus.IN_PROGRESS.value,
        "pending",
        "in_progress",
    }


@pytest.mark.integration
def test_int_wf_02_three_step_approve_activates_only_on_final(wf_db, tenant_ids) -> None:
    """INT-WF-02: 3-step seed — intermediate stays submitted; final → active + master."""
    seed_ast_asset_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_draft_asset(wf_db, tenant_ids)
    svc = AssetService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)
    master_id = uuid4()
    master = MagicMock()
    master.id = master_id

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._master, "create_or_link_master_asset", return_value=master),
    ):
        svc.submit(creator_ctx, asset.id)

        after_1 = svc.approve(approver_ctx, asset.id)
        assert after_1.status == "submitted"
        assert after_1.workflow_status == WorkflowStatus.IN_PROGRESS.value
        assert after_1.master_asset_id is None

        after_2 = svc.approve(approver_ctx, asset.id)
        assert after_2.status == "submitted"
        assert after_2.workflow_status == WorkflowStatus.IN_PROGRESS.value
        assert after_2.master_asset_id is None

        after_3 = svc.approve(approver_ctx, asset.id)
        assert after_3.status == "active"
        assert after_3.workflow_status == WorkflowStatus.APPROVED.value
        assert after_3.master_asset_id == master_id


@pytest.mark.integration
def test_int_wf_06_reject_sets_cancelled_and_workflow_rejected(wf_db, tenant_ids) -> None:
    """INT-WF-06: reject → status=cancelled, workflow_status=rejected."""
    seed_ast_asset_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_draft_asset(wf_db, tenant_ids)
    svc = AssetService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        svc.submit(creator_ctx, asset.id)
        rejected = svc.reject(approver_ctx, asset.id, comments="not required")

    assert rejected.status == "cancelled"
    assert rejected.workflow_status == WorkflowStatus.REJECTED.value

    instance = wf_db.scalar(
        select(WfInstance).where(WfInstance.id == rejected.workflow_instance_id)
    )
    assert instance is not None
    assert instance.status in {WorkflowStatus.REJECTED.value, "rejected", WorkflowStatus.REJECTED}


@pytest.mark.integration
def test_int_reg_resubmit_creates_second_workflow_instance(wf_db, tenant_ids) -> None:
    """Reject → resubmit allocates a new wf_instance (ADR-REG-02)."""
    seed_ast_asset_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_draft_asset(wf_db, tenant_ids)
    svc = AssetService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        svc.submit(creator_ctx, asset.id)
        first_instance_id = svc.get(creator_ctx, asset.id).workflow_instance_id
        svc.reject(approver_ctx, asset.id)
        assert count_wf_instances(wf_db, tenant_ids["tenant_id"], asset.id) == 1
        svc.resubmit(creator_ctx, asset.id)
        second_instance_id = svc.get(creator_ctx, asset.id).workflow_instance_id

    assert first_instance_id is not None
    assert second_instance_id is not None
    assert second_instance_id != first_instance_id
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], asset.id) == 2
