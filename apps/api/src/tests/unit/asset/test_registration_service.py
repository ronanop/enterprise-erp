"""AssetService registration lifecycle tests (cancel, reopen, resubmit)."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.enums import AssetStatus
from modules.asset.domain.exceptions import InvalidAssetWorkflowState
from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.enums import WorkflowStatus
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _draft_row():
    row = MagicMock()
    row.id = uuid4()
    row.status = AssetStatus.DRAFT.value
    row.workflow_instance_id = None
    row.workflow_status = None
    row.master_asset_id = None
    row.created_by = uuid4()
    return row


def test_cancel_draft() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = _draft_row()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as mock_up:
            svc.cancel_draft(ctx, row.id)
            mock_up.assert_called_once()
            assert row.status == AssetStatus.CANCELLED.value


def test_cancel_fails_after_workflow_started() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = _draft_row()
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.cancel_draft(ctx, row.id)


def test_reopen_clears_workflow_fields() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = _draft_row()
    row.status = AssetStatus.CANCELLED.value
    row.workflow_status = WorkflowStatus.REJECTED.value
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as mock_up:
            svc.reopen(ctx, row.id)
            mock_up.assert_called_once()
            _, kwargs = mock_up.call_args
            assert kwargs.get("workflow_status") is None
            assert kwargs.get("workflow_instance_id") is None
            assert row.status == AssetStatus.DRAFT.value


@patch("modules.asset.service.asset_service.asset_workflow_governance_enabled", return_value=True)
def test_resubmit_reopens_then_submits(_gov) -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = _draft_row()
    row.status = AssetStatus.CANCELLED.value
    row.workflow_status = WorkflowStatus.REJECTED.value
    row.purchase_date = date.today()
    row.purchase_cost = Decimal("1")
    row.currency_code = "USD"
    row.asset_name = "X"
    row.asset_category_id = uuid4()
    row.asset_type = "fixed"

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc, "reopen", return_value=row) as mock_reopen:
            with patch.object(svc, "submit", return_value=row) as mock_submit:
                svc.resubmit(ctx, row.id)
                mock_reopen.assert_called_once()
                mock_submit.assert_called_once()


@patch("modules.asset.service.asset_service.asset_workflow_governance_enabled", return_value=False)
def test_submit_auto_activates_when_governance_off(_gov) -> None:
    """Add Asset UX: gov-off submit must reach active (mirrors assignment submit)."""
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = _draft_row()
    row.version = 1
    row.purchase_date = date.today()
    row.purchase_cost = Decimal("1")
    row.currency_code = "INR"
    row.asset_name = "Laptop"
    row.asset_category_id = uuid4()
    row.asset_type = "fixed"
    row.company_id = ctx.company_id
    row.branch_id = ctx.branch_id

    def _engine_submit(r) -> None:
        r.status = AssetStatus.SUBMITTED.value

    def _engine_approve(r) -> None:
        r.status = AssetStatus.APPROVED.value

    def _engine_activate(r) -> None:
        r.status = AssetStatus.ACTIVE.value

    active = MagicMock()
    active.id = row.id
    active.status = AssetStatus.ACTIVE.value
    active.master_asset_id = uuid4()
    active.version = 2

    with (
        patch.object(svc, "get", side_effect=[row, row]),
        patch.object(svc._validator, "validate_submit_readiness"),
        patch.object(svc._engine, "submit", side_effect=_engine_submit),
        patch.object(svc._engine, "approve", side_effect=_engine_approve),
        patch.object(svc._engine, "activate", side_effect=_engine_activate),
        patch.object(svc._repo, "update", return_value=active),
        patch.object(svc._master, "create_or_link_master_asset", return_value=MagicMock(id=uuid4())),
        patch.object(svc._operational, "initialize_ready_to_move", return_value="READY_TO_MOVE"),
        patch.object(svc._audit, "log_entity_change"),
    ):
        out = svc.submit(ctx, row.id)
        assert out.status == AssetStatus.ACTIVE.value
        svc._engine.approve.assert_called_once()
        svc._engine.activate.assert_called_once()


@patch("modules.asset.service.asset_service.asset_workflow_governance_enabled", return_value=True)
def test_submit_creates_new_workflow_instance(_gov) -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    row = _draft_row()
    row.purchase_date = date.today()
    row.purchase_cost = Decimal("10")
    row.currency_code = "USD"
    row.asset_name = "Asset"
    row.asset_category_id = uuid4()
    row.asset_type = "fixed"
    row.company_id = ctx.company_id
    instance = MagicMock()
    instance.id = uuid4()

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_submit_readiness"):
            with patch.object(svc._governance, "submit_for_approval", return_value=instance):
                with patch.object(svc._repo, "update", return_value=row) as mock_up:
                    svc.submit(ctx, row.id)
                    mock_up.assert_called_once()
                    assert mock_up.call_args.kwargs.get("workflow_instance_id") == instance.id
