"""Asset disposal workflow integration tests (FP-ASSET-005)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import DisposalValidationError
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.service.disposal_service import DisposalService
from modules.foundation.domain.value_objects import TenantContext
from tests.integration.asset.conftest import (
    count_wf_instances,
    insert_active_asset,
    seed_ast_disposal_approval,
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
        "modules.asset.service.disposal_service.asset_workflow_governance_enabled",
        return_value=True,
    )


def _silence_side_channels():
    return (
        patch(
            "modules.asset.service.governance_service.AuditService.log_entity_change",
            return_value=None,
        ),
        patch(
            "modules.asset.service.disposal_service.AuditService.log_entity_change",
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


def _gate_patches(svc: DisposalService):
    return (
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=None,
        ),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    )


def _insert_draft_disposal(db, ids, asset_id, *, disposal_type: str = "scrap") -> AstAssetDisposal:
    now = datetime.now(timezone.utc)
    row = AstAssetDisposal(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"ADISP-TEST-{uuid4().hex[:8]}",
        asset_id=asset_id,
        disposal_type=disposal_type,
        disposal_date=date.today(),
        book_value_at_disposal=Decimal("500.0000"),
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
def test_int_dsp_submit_creates_workflow_instance(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)

    patches = _silence_side_channels()
    gates = _gate_patches(svc)
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        gates[0],
        gates[1],
        gates[2],
        gates[3],
    ):
        submitted = svc.submit(creator_ctx, disposal.id)

    assert submitted.status == "submitted"
    assert submitted.workflow_instance_id is not None
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], disposal.id) == 1


@pytest.mark.integration
def test_int_dsp_three_step_approve_then_post_disposes_asset(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id, disposal_type="sale")
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)
    journal_id = uuid4()

    patches = _silence_side_channels()
    gates = _gate_patches(svc)
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        gates[0],
        gates[1],
        gates[2],
        gates[3],
        patch.object(svc._finance, "post_disposal", return_value=journal_id),
        patch.object(svc._master, "mark_master_disposed", return_value=None),
    ):
        svc.submit(creator_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        approved = svc.approve(approver_ctx, disposal.id)
        assert approved.status == "approved"
        wf_db.refresh(asset)
        assert asset.status == "active"

        posted = svc.post(
            approver_ctx,
            disposal.id,
            debit_account_id=uuid4(),
            credit_account_id=uuid4(),
        )
        assert posted.status == "posted"
        assert posted.finance_journal_id == journal_id
        wf_db.refresh(asset)
        assert asset.status == "disposed"


@pytest.mark.integration
def test_int_dsp_second_post_rejected_finance_called_once(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id, disposal_type="sale")
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)
    journal_id = uuid4()

    patches = _silence_side_channels()
    gates = _gate_patches(svc)
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        gates[0],
        gates[1],
        gates[2],
        gates[3],
        patch.object(svc._finance, "post_disposal", return_value=journal_id) as post_fn,
        patch.object(svc._master, "mark_master_disposed", return_value=None),
    ):
        svc.submit(creator_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.post(
            approver_ctx,
            disposal.id,
            debit_account_id=uuid4(),
            credit_account_id=uuid4(),
        )
        with pytest.raises(DisposalValidationError, match="already posted"):
            svc.post(
                approver_ctx,
                disposal.id,
                debit_account_id=uuid4(),
                credit_account_id=uuid4(),
            )
        assert post_fn.call_count == 1


@pytest.mark.integration
def test_int_dsp_write_off_post_sets_written_off(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id, disposal_type="write_off")
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    gates = _gate_patches(svc)
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        gates[0],
        gates[1],
        gates[2],
        gates[3],
        patch.object(svc._finance, "post_disposal", return_value=uuid4()),
        patch.object(svc._master, "mark_master_disposed", return_value=None),
    ):
        svc.submit(creator_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.approve(approver_ctx, disposal.id)
        svc.post(
            approver_ctx,
            disposal.id,
            debit_account_id=uuid4(),
            credit_account_id=uuid4(),
        )
        wf_db.refresh(asset)
        assert asset.status == "written_off"


@pytest.mark.integration
def test_int_dsp_reject_reopen_resubmit(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    approver_ctx = _ctx(tenant_ids, as_approver=True)

    patches = _silence_side_channels()
    gates = _gate_patches(svc)
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        gates[0],
        gates[1],
        gates[2],
        gates[3],
    ):
        svc.submit(creator_ctx, disposal.id)
        first_instance_id = svc.get(creator_ctx, disposal.id).workflow_instance_id
        svc.reject(approver_ctx, disposal.id)
        reopened = svc.reopen(creator_ctx, disposal.id)
        assert reopened.status == "draft"
        assert reopened.workflow_instance_id is None
        resubmitted = svc.resubmit(creator_ctx, disposal.id)
        second_instance_id = resubmitted.workflow_instance_id

    assert first_instance_id is not None
    assert second_instance_id is not None
    assert first_instance_id != second_instance_id
    assert resubmitted.status == "submitted"
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], disposal.id) == 2


@pytest.mark.integration
def test_int_dsp_cancel_draft(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        cancelled = svc.cancel_draft(creator_ctx, disposal.id)
    assert cancelled.status == "cancelled"


@pytest.mark.integration
def test_int_dsp_open_disposal_exclusivity_blocks_second_create(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    first = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._numbers, "generate", return_value=f"ADISP-TEST-{uuid4().hex[:8]}"),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=None,
        ),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        with pytest.raises(DisposalValidationError, match="open disposal"):
            svc.create(
                creator_ctx,
                branch_id=tenant_ids["branch_id"],
                company_id=tenant_ids["company_id"],
                asset_id=asset.id,
                disposal_type="scrap",
                disposal_date=date.today(),
            )
    assert first.status == "draft"


@pytest.mark.integration
def test_int_dsp_maintenance_gate_blocks_submit(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    open_wo = type("WO", (), {"document_number": "AMNT-OPEN-1"})()

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=open_wo),
        patch.object(
            svc._validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=None,
        ),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        with pytest.raises(DisposalValidationError, match="open maintenance"):
            svc.submit(creator_ctx, disposal.id)


@pytest.mark.integration
def test_int_dsp_assignment_gate_blocks_submit(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    open_asn = type("ASN", (), {"document_number": "AASN-OPEN-1"})()

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=open_asn,
        ),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=None),
    ):
        with pytest.raises(DisposalValidationError, match="open assignment"):
            svc.submit(creator_ctx, disposal.id)


@pytest.mark.integration
def test_int_dsp_transfer_gate_blocks_submit(wf_db, tenant_ids) -> None:
    seed_ast_disposal_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    disposal = _insert_draft_disposal(wf_db, tenant_ids, asset.id)
    svc = DisposalService(wf_db)
    creator_ctx = _ctx(tenant_ids)
    pending = type("TRF", (), {"document_number": "ATRF-OPEN-1"})()

    patches = _silence_side_channels()
    with (
        _enable_governance(),
        patches[0],
        patches[1],
        patches[2],
        patches[3],
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(svc._validator._maintenances, "find_open_for_asset", return_value=None),
        patch.object(
            svc._validator._assignments,
            "find_pending_or_active_for_asset",
            return_value=None,
        ),
        patch.object(svc._validator._transfers, "find_pending_for_asset", return_value=pending),
    ):
        with pytest.raises(DisposalValidationError, match="pending transfer"):
            svc.submit(creator_ctx, disposal.id)
