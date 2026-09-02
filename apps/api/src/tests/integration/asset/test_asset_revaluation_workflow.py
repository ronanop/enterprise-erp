"""Asset revaluation workflow integration tests (FP-ASSET-007)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import RevaluationValidationError
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.service.revaluation_service import RevaluationService
from modules.foundation.domain.value_objects import TenantContext
from tests.integration.asset.conftest import (
    count_wf_instances,
    insert_active_asset,
    seed_ast_revaluation_approval,
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
        "modules.asset.service.revaluation_service.asset_workflow_governance_enabled",
        return_value=True,
    )


def _silence_side_channels():
    return (
        patch(
            "modules.asset.service.governance_service.AuditService.log_entity_change", return_value=None
        ),
        patch(
            "modules.asset.service.revaluation_service.AuditService.log_entity_change", return_value=None
        ),
        patch(
            "modules.foundation.service.workflow_service.AuditService.log_entity_change", return_value=None
        ),
        patch(
            "modules.asset.service.governance_service.NotificationService.list_templates", return_value=[]
        ),
    )


def _create(svc: RevaluationService, ctx: TenantContext, asset, value: Decimal = Decimal("650")):
    return svc.create(
        ctx,
        branch_id=asset.branch_id,
        company_id=asset.company_id,
        asset_id=asset.id,
        new_book_value=value,
        reason="Independent valuation",
        revaluation_date=date.today(),
    )


@pytest.mark.integration
def test_int_rev_create_captures_old_book(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500.0000")
    wf_db.flush()
    svc = RevaluationService(wf_db)
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000001"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        row = _create(svc, _ctx(tenant_ids), asset)
    assert row.old_book_value == Decimal("500.0000")
    assert row.new_book_value == Decimal("650")


@pytest.mark.integration
def test_int_rev_submit_creates_wf_instance(wf_db, tenant_ids) -> None:
    seed_ast_revaluation_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500")
    svc = RevaluationService(wf_db)
    patches = _silence_side_channels()
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000002"),
        _enable_governance(),
        patches[0], patches[1], patches[2], patches[3],
    ):
        row = _create(svc, _ctx(tenant_ids), asset)
        submitted = svc.submit(_ctx(tenant_ids), row.id)
    assert submitted.status == "submitted"
    assert submitted.workflow_instance_id is not None
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], row.id) == 1


@pytest.mark.integration
def test_int_rev_cannot_submit_without_revaluation_date(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500")
    svc = RevaluationService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000007"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        row = svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=asset.company_id,
            asset_id=asset.id,
            new_book_value=Decimal("650"),
            reason="Independent valuation",
        )
        assert row.revaluation_date is None
        with pytest.raises(RevaluationValidationError, match="revaluation_date"):
            svc.submit(ctx, row.id)
        updated = svc.update(ctx, row.id, revaluation_date=date.today(), version=row.version)
        assert updated.revaluation_date is not None
        submitted = svc.submit(ctx, updated.id)
    assert submitted.status == "submitted"


@pytest.mark.integration
def test_int_rev_draft_update_without_date_still_works(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500")
    svc = RevaluationService(wf_db)
    ctx = _ctx(tenant_ids)
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000008"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        row = svc.create(
            ctx,
            branch_id=asset.branch_id,
            company_id=asset.company_id,
            asset_id=asset.id,
            new_book_value=Decimal("650"),
            reason="Independent valuation",
        )
        updated = svc.update(
            ctx,
            row.id,
            reason="Updated reason without date",
            version=row.version,
        )
    assert updated.status == "draft"
    assert updated.revaluation_date is None
    assert updated.reason == "Updated reason without date"


@pytest.mark.integration
def test_int_rev_post_updates_book_value(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500")
    svc = RevaluationService(wf_db)
    ctx = _ctx(tenant_ids)
    journal_id = uuid4()
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000003"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch(
            "modules.asset.service.revaluation_service.asset_workflow_governance_enabled",
            return_value=False,
        ),
        patch.object(svc._finance, "post_revaluation", return_value=journal_id),
    ):
        row = _create(svc, ctx, asset)
        approved = svc.approve(ctx, row.id)
        posted = svc.post(ctx, approved.id, debit_account_id=uuid4(), credit_account_id=uuid4())
    assert posted.status == "posted"
    assert posted.finance_journal_id == journal_id
    wf_db.refresh(asset)
    assert asset.current_book_value == Decimal("650")


@pytest.mark.integration
def test_int_rev_open_revaluation_blocks_second(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500")
    svc = RevaluationService(wf_db)
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000004"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        _create(svc, _ctx(tenant_ids), asset)
        with pytest.raises(RevaluationValidationError, match="open revaluation"):
            _create(svc, _ctx(tenant_ids), asset, Decimal("700"))


@pytest.mark.integration
def test_int_rev_open_disposal_blocks_create(wf_db, tenant_ids) -> None:
    asset = insert_active_asset(wf_db, tenant_ids)
    now = datetime.now(timezone.utc)
    wf_db.add(
        AstAssetDisposal(
            id=uuid4(), tenant_id=tenant_ids["tenant_id"], company_id=tenant_ids["company_id"],
            branch_id=tenant_ids["branch_id"], document_number="ADISP-TEST-000001", asset_id=asset.id,
            disposal_type="scrap", disposal_date=date.today(), book_value_at_disposal=Decimal("500"),
            status="draft", is_deleted=False, version=1, created_at=now, updated_at=now,
            created_by=tenant_ids["creator_id"], updated_by=tenant_ids["creator_id"],
        )
    )
    wf_db.flush()
    svc = RevaluationService(wf_db)
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000005"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        with pytest.raises(RevaluationValidationError, match="open disposal"):
            _create(svc, _ctx(tenant_ids), asset)


@pytest.mark.integration
def test_int_rev_cancel_reopen_resubmit(wf_db, tenant_ids) -> None:
    seed_ast_revaluation_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    asset.current_book_value = Decimal("500")
    svc = RevaluationService(wf_db)
    patches = _silence_side_channels()
    with (
        patch.object(svc._numbers, "generate", return_value="AREV-TEST-000006"),
        _enable_governance(),
        patches[0], patches[1], patches[2], patches[3],
    ):
        row = _create(svc, _ctx(tenant_ids), asset)
        submitted = svc.submit(_ctx(tenant_ids), row.id)
        first_instance_id = submitted.workflow_instance_id
        svc.reject(_ctx(tenant_ids, as_approver=True), row.id)
        reopened = svc.reopen(_ctx(tenant_ids), row.id)
        assert reopened.status == "draft"
        resubmitted = svc.resubmit(_ctx(tenant_ids), row.id)
    assert resubmitted.status == "submitted"
    assert resubmitted.workflow_instance_id != first_instance_id
    assert count_wf_instances(wf_db, tenant_ids["tenant_id"], row.id) == 2
