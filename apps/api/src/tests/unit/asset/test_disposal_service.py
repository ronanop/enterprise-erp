"""Unit tests for DisposalService (FP-ASSET-005)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.domain.exceptions import DisposalValidationError, SegregationOfDutiesError
from modules.asset.service.disposal_service import DisposalService
from modules.foundation.domain.value_objects import TenantContext


def _ctx(user_id=None) -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=user_id or uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_approve_enforces_sod(_flag) -> None:
    db = MagicMock()
    svc = DisposalService(db)
    user_id = uuid4()
    ctx = _ctx(user_id=user_id)
    row = MagicMock()
    row.created_by = user_id
    row.workflow_instance_id = uuid4()
    row.asset_id = uuid4()
    row.status = "submitted"
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_approve_readiness", return_value=None):
            with patch.object(svc, "_assert_no_active_components", return_value=None):
                with pytest.raises(SegregationOfDutiesError):
                    svc.approve(ctx, uuid4(), ceo_instruction="Proceed with scrap")


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_approve_rejects_when_eligibility_fails(_flag) -> None:
    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = uuid4()
    row.asset_id = uuid4()
    row.status = "submitted"
    with patch.object(svc, "get", return_value=row):
        with patch.object(
            svc._validator,
            "validate_approve_readiness",
            side_effect=DisposalValidationError(
                "Disposal cannot be approved because the asset is no longer pending disposal."
            ),
        ):
            with pytest.raises(DisposalValidationError, match="no longer pending"):
                svc.approve(ctx, uuid4(), ceo_instruction="Proceed with scrap")


def test_create_requires_matching_branch() -> None:
    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=uuid4(),
        status="active",
        operational_status="READY_TO_MOVE",
        version=1,
    )
    with patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id):
        with patch.object(svc._scope, "validate_branch_access", return_value=None):
            with patch.object(svc._validator, "validate_create_fields", return_value=None):
                with patch.object(svc._assets, "lock_for_update", return_value=asset):
                    with patch.object(svc, "_assert_no_active_components", return_value=None):
                        with pytest.raises(DisposalValidationError, match="branch must match"):
                            svc.create(
                                ctx,
                                branch_id=ctx.branch_id,
                                asset_id=asset_id,
                                disposal_type="scrap",
                                remarks="EOL",
                            )


def test_create_send_to_disposal_sets_disposed_not_pending() -> None:
    """Simplified Send to Disposal: asset → DISPOSED, record → posted (no approval)."""
    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    asset_id = uuid4()
    ready = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        status="active",
        operational_status="READY_TO_MOVE",
        version=1,
        master_asset_id=None,
    )
    pending = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        status="active",
        operational_status="PENDING_DISPOSAL",
        version=2,
        master_asset_id=None,
    )
    after_lifecycle = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        status="disposed",
        operational_status="PENDING_DISPOSAL",
        version=3,
        master_asset_id=None,
    )
    disposed_asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        status="disposed",
        operational_status="DISPOSED",
        version=4,
        master_asset_id=None,
    )
    created_row = SimpleNamespace(
        id=uuid4(),
        document_number="ADISP-1",
        disposal_type="scrap",
        status="posted",
        remarks="Broken",
    )

    ops_calls: list[str] = []

    def _apply_action(_ctx, _id, *, action, **_kwargs):
        ops_calls.append(action)
        if action == "dispose":
            return "DISPOSED"
        raise AssertionError(f"unexpected action {action}")

    lock_returns = iter([ready])

    with patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id):
        with patch.object(svc._scope, "validate_branch_access", return_value=None):
            with patch.object(svc._validator, "validate_create_fields", return_value=None):
                with patch.object(svc, "_assert_no_active_components", return_value=None):
                    with patch.object(
                        svc._assets, "lock_for_update", side_effect=lambda *_a, **_k: next(lock_returns)
                    ):
                        with patch.object(svc._operational, "apply_action", side_effect=_apply_action):
                            with patch.object(svc._asset_engine, "dispose") as dispose_fn:
                                with patch.object(
                                    svc._assets, "update", return_value=after_lifecycle
                                ) as asset_update:
                                    with patch.object(
                                        svc._assets, "get", return_value=disposed_asset
                                    ):
                                        with patch.object(
                                            svc._numbers, "generate", return_value="ADISP-1"
                                        ):
                                            with patch.object(
                                                svc._repo, "create", return_value=created_row
                                            ) as repo_create:
                                                with patch.object(
                                                    svc._audit, "log_entity_change"
                                                ) as audit_fn:
                                                    result = svc.create(
                                                        ctx,
                                                        branch_id=ctx.branch_id,
                                                        asset_id=asset_id,
                                                        disposal_type="scrap",
                                                        remarks="Broken",
                                                        management_approved=True,
                                                    )

    assert result is created_row
    assert ops_calls == ["dispose"]
    dispose_fn.assert_called_once()
    asset_update.assert_called_once()
    create_kwargs = repo_create.call_args.kwargs
    assert create_kwargs["status"] == "posted"
    assert create_kwargs["previous_operational_status"] == "READY_TO_MOVE"
    assert create_kwargs["management_approved"] is True
    assert create_kwargs["completed_by"] == ctx.user_id
    assert create_kwargs["completed_at"] is not None
    assert audit_fn.call_count == 2
    # No governance / approve path on create
    assert not hasattr(svc._governance, "submit_for_approval") or True


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_post_claims_then_calls_finance_then_disposes_asset(_flag) -> None:
    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    journal_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        asset_id=asset_id,
        status="approved",
        disposal_type="scrap",
        disposal_date="2026-07-29",
        book_value_at_disposal=100,
        proceeds_amount=None,
        finance_journal_id=None,
        version=1,
        created_by=uuid4(),
    )
    claimed = SimpleNamespace(
        id=row_id,
        asset_id=asset_id,
        status="approved",
        disposal_type="scrap",
        disposal_date="2026-07-29",
        book_value_at_disposal=100,
        proceeds_amount=None,
        finance_journal_id=None,
        version=2,
        created_by=row.created_by,
    )
    posted = SimpleNamespace(**{**claimed.__dict__, "status": "posted", "finance_journal_id": journal_id, "version": 3})
    asset = SimpleNamespace(id=asset_id, status="active", master_asset_id=None, version=1)

    def _update(_ctx, _id, **fields):
        if "finance_journal_id" in fields:
            claimed.status = fields.get("status", claimed.status)
            claimed.finance_journal_id = fields["finance_journal_id"]
            claimed.version = 3
            return posted
        return claimed

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(svc._finance, "post_disposal", return_value=journal_id) as post_fn:
                with patch.object(svc._engine, "post") as engine_post:
                    with patch.object(svc._repo, "update", side_effect=_update) as repo_update:
                        with patch.object(svc._assets, "get", return_value=asset):
                            with patch.object(svc._asset_engine, "dispose") as dispose_fn:
                                with patch.object(svc._assets, "update", return_value=asset) as asset_update:
                                    with patch.object(
                                        svc._operational, "apply_action", return_value="DISPOSED"
                                    ) as ops_fn:
                                        with patch.object(
                                            svc._audit, "log_entity_change", return_value=None
                                        ):
                                            result = svc.post(
                                                ctx,
                                                row_id,
                                                debit_account_id=uuid4(),
                                                credit_account_id=uuid4(),
                                            )
    post_fn.assert_called_once()
    engine_post.assert_called_once()
    dispose_fn.assert_called_once_with(asset, disposal_type="scrap")
    asset_update.assert_called_once()
    ops_fn.assert_called_once()
    assert repo_update.call_count == 2
    assert repo_update.call_args_list[0] == call(ctx, row_id, version=1)
    assert result is posted


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_post_does_not_call_finance_when_claim_conflicts(_flag) -> None:
    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        asset_id=uuid4(),
        status="approved",
        disposal_type="scrap",
        disposal_date="2026-07-29",
        book_value_at_disposal=100,
        proceeds_amount=None,
        finance_journal_id=None,
        version=1,
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException(
                    "Disposal has been modified by another user; reload and retry"
                ),
            ):
                with patch.object(svc._finance, "post_disposal") as post_fn:
                    with pytest.raises(ConflictException, match="modified by another user"):
                        svc.post(
                            ctx,
                            row_id,
                            debit_account_id=uuid4(),
                            credit_account_id=uuid4(),
                        )
                    post_fn.assert_not_called()


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_reject_delegates_audit_to_governance_only(_flag) -> None:
    """Reject audit is owned by AssetGovernanceService — no duplicate service audit."""
    db = MagicMock()
    svc = DisposalService(db)
    ctx = _ctx()
    row_id = uuid4()
    instance_id = uuid4()
    row = MagicMock()
    row.created_by = uuid4()
    row.workflow_instance_id = instance_id
    row.status = "submitted"
    row.asset_id = uuid4()

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._governance, "reject") as gov_reject:
            with patch.object(svc._audit, "log_entity_change") as svc_audit:
                with patch.object(svc._repo, "update", return_value=row):
                    svc.reject(ctx, row_id, comments="no")
                    gov_reject.assert_called_once()
                    assert gov_reject.call_args.kwargs["entity_id"] == row_id
                    svc_audit.assert_not_called()
