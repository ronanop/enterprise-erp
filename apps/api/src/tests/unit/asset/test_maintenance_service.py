"""Unit tests for MaintenanceService asset status transitions."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from modules.asset.domain.enums import AssetOperationalStatus, AssetStatus
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


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=True)
def test_start_sets_asset_in_maintenance(_flag) -> None:
    db = MagicMock()
    svc = MaintenanceService(db)
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="approved",
        asset_id=asset_id,
        created_by=ctx.user_id,
    )
    asset = SimpleNamespace(
        id=asset_id,
        status=AssetStatus.ACTIVE.value,
        operational_status=AssetOperationalStatus.READY_TO_MOVE.value,
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_start_readiness"):
            with patch.object(svc._engine, "start") as start:
                with patch.object(svc._assets, "get", return_value=asset):
                    with patch.object(svc._assets, "update") as asset_update:
                        with patch.object(svc._operational, "apply_action") as ops_action:
                            with patch.object(svc._repo, "update", return_value=row) as repo_update:
                                with patch.object(svc._audit, "log_entity_change"):
                                    def _start(r):
                                        r.status = "in_progress"

                                    start.side_effect = _start
                                    svc.start(ctx, row_id)
                                    asset_update.assert_called_once_with(
                                        ctx, asset_id, status=AssetStatus.IN_MAINTENANCE.value
                                    )
                                    ops_action.assert_called_once()
                                    repo_update.assert_called()


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=True)
def test_complete_restores_active_when_no_other_open(_flag) -> None:
    db = MagicMock()
    svc = MaintenanceService(db)
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="in_progress",
        asset_id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        maintenance_type="preventive",
        cost_amount=None,
        created_by=ctx.user_id,
    )
    asset = SimpleNamespace(
        id=asset_id,
        status=AssetStatus.IN_MAINTENANCE.value,
        operational_status=AssetOperationalStatus.IN_MAINTENANCE.value,
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_complete_readiness"):
            with patch.object(svc._engine, "complete") as complete:
                with patch.object(svc._repo, "update", return_value=row):
                    with patch.object(svc._history, "create"):
                        with patch.object(
                            svc._repo, "find_open_for_asset", return_value=None
                        ):
                            with patch.object(svc._assets, "get", return_value=asset):
                                with patch.object(svc._assets, "update") as asset_update:
                                    with patch.object(svc._operational, "apply_action") as ops_action:
                                        with patch.object(svc._audit, "log_entity_change"):
                                            def _complete(r):
                                                r.status = "completed"

                                            complete.side_effect = _complete
                                            svc.complete(ctx, row_id)
                                            asset_update.assert_called_once_with(
                                                ctx, asset_id, status=AssetStatus.ACTIVE.value
                                            )
                                            ops_action.assert_called_once()


@patch("modules.asset.service.maintenance_service.asset_workflow_governance_enabled", return_value=True)
def test_complete_keeps_in_maintenance_when_other_open(_flag) -> None:
    db = MagicMock()
    svc = MaintenanceService(db)
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="in_progress",
        asset_id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        maintenance_type="corrective",
        cost_amount=10,
        created_by=ctx.user_id,
    )
    asset = SimpleNamespace(
        id=asset_id,
        status=AssetStatus.IN_MAINTENANCE.value,
        operational_status=AssetOperationalStatus.IN_MAINTENANCE.value,
    )
    other = SimpleNamespace(id=uuid4(), document_number="AMNT-OTHER")
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_complete_readiness"):
            with patch.object(svc._engine, "complete") as complete:
                with patch.object(svc._repo, "update", return_value=row):
                    with patch.object(svc._history, "create"):
                        with patch.object(
                            svc._repo, "find_open_for_asset", return_value=other
                        ):
                            with patch.object(svc._assets, "get", return_value=asset):
                                with patch.object(svc._assets, "update") as asset_update:
                                    with patch.object(svc._operational, "apply_action") as ops_action:
                                        with patch.object(svc._audit, "log_entity_change"):
                                            def _complete(r):
                                                r.status = "completed"

                                            complete.side_effect = _complete
                                            svc.complete(ctx, row_id)
                                            asset_update.assert_not_called()
                                            ops_action.assert_not_called()
