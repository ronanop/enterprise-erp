"""Unit tests for MaintenanceService.start_maintenance orchestration."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import MaintenanceApprovalPendingError
from modules.asset.service.maintenance_service import MaintenanceService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=False)
def test_start_maintenance_chains_submit_approve_start_when_governance_off(_gov) -> None:
    svc = MaintenanceService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    state = {"status": "draft"}

    def _row() -> SimpleNamespace:
        return SimpleNamespace(
            id=row_id,
            status=state["status"],
            asset_id=uuid4(),
            created_by=ctx.user_id,
            scheduled_date=None,
            maintenance_type="preventive",
            company_id=ctx.company_id,
            branch_id=ctx.branch_id,
            version=1,
            workflow_status=None,
            workflow_instance_id=None,
            reason=None,
            expected_duration_days=None,
            cost_amount=None,
        )

    def _get(_ctx, _id):
        return _row()

    def _submit(_ctx, _id):
        state["status"] = "submitted"
        return _row()

    def _approve(_ctx, _id):
        state["status"] = "approved"
        return _row()

    def _start(_ctx, _id):
        state["status"] = "in_progress"
        return _row()

    with (
        patch.object(svc, "get", side_effect=_get),
        patch.object(svc, "update", side_effect=lambda *a, **k: _row()),
        patch.object(svc, "submit", side_effect=_submit),
        patch.object(svc, "approve", side_effect=_approve),
        patch.object(svc, "start", side_effect=_start),
    ):
        row, outcome, _msg = svc.start_maintenance(
            ctx,
            row_id,
            reason="Screen repair",
            expected_duration_days=3,
        )
        assert outcome == "started"
        assert row.status == "in_progress"
        svc.submit.assert_called_once()
        svc.approve.assert_called_once()
        svc.start.assert_called_once()


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=True)
def test_start_maintenance_surfaces_approval_pending_when_still_submitted(_gov) -> None:
    svc = MaintenanceService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    submitted = SimpleNamespace(
        id=row_id,
        status="submitted",
        asset_id=uuid4(),
        created_by=ctx.user_id,
        scheduled_date=None,
        maintenance_type="preventive",
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        version=1,
        workflow_status="in_progress",
        workflow_instance_id=uuid4(),
        reason="Battery",
        expected_duration_days=2,
        cost_amount=None,
    )

    with (
        patch.object(svc, "get", return_value=submitted),
        patch.object(svc, "update", return_value=submitted),
        patch.object(svc, "submit", return_value=submitted),
        patch.object(svc, "approve", return_value=submitted),
    ):
        with pytest.raises(MaintenanceApprovalPendingError, match="approval"):
            svc.start_maintenance(
                ctx,
                row_id,
                reason="Battery",
                expected_duration_days=2,
            )


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=False)
def test_start_from_asset_creates_then_starts(_gov) -> None:
    svc = MaintenanceService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row_id = uuid4()
    asset = SimpleNamespace(id=asset_id, branch_id=ctx.branch_id)
    draft = SimpleNamespace(id=row_id, status="draft", version=1, asset_id=asset_id)
    started = SimpleNamespace(id=row_id, status="in_progress", version=3, asset_id=asset_id)

    with (
        patch.object(svc._assets, "get", return_value=asset),
        patch.object(svc._repo, "find_open_for_asset", return_value=None),
        patch.object(svc, "create", return_value=draft) as create,
        patch.object(svc, "start_maintenance", return_value=(started, "started", None)) as start,
    ):
        row, outcome, _msg = svc.start_from_asset(
            ctx,
            asset_id=asset_id,
            reason="Screen issue",
            expected_duration_days=5,
        )

    assert outcome == "started"
    assert row.status == "in_progress"
    create.assert_called_once()
    start.assert_called_once()
    assert start.call_args.kwargs["reason"] == "Screen issue"
    assert start.call_args.kwargs["expected_duration_days"] == 5


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=False)
def test_start_from_asset_reuses_existing_draft(_gov) -> None:
    svc = MaintenanceService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row_id = uuid4()
    asset = SimpleNamespace(id=asset_id, branch_id=ctx.branch_id)
    draft = SimpleNamespace(id=row_id, status="draft", version=2, asset_id=asset_id)
    started = SimpleNamespace(id=row_id, status="in_progress", version=4, asset_id=asset_id)

    with (
        patch.object(svc._assets, "get", return_value=asset),
        patch.object(svc._repo, "find_open_for_asset", return_value=draft),
        patch.object(svc, "create") as create,
        patch.object(svc, "start_maintenance", return_value=(started, "started", None)) as start,
    ):
        row, outcome, _msg = svc.start_from_asset(
            ctx,
            asset_id=asset_id,
            reason="Battery",
            expected_duration_days=3,
        )

    assert outcome == "started"
    assert row.status == "in_progress"
    create.assert_not_called()
    assert start.call_args.args[1] == row_id
