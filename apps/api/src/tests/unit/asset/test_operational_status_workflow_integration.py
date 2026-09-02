"""CR-004 Phase 2B-2 workflow integration tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.enums import AssetOperationalStatus
from modules.asset.domain.operational_status_audit_events import OperationalStatusAuditEvent
from modules.asset.domain.operational_status_exceptions import (
    InvalidTransition,
    OperationalStatusConflict,
)
from modules.asset.service.asset_operational_status_service import AssetOperationalStatusService
from modules.asset.service.assignment_service import AssignmentService
from modules.asset.service.disposal_service import DisposalService
from modules.asset.service.operational_status_audit import audit_event_for_action, log_operational_status_change
from modules.foundation.domain.value_objects import TenantContext

Ready = AssetOperationalStatus.READY_TO_MOVE.value
Assigned = AssetOperationalStatus.ASSIGNED.value
Retired = AssetOperationalStatus.RETIRED.value
Pending = AssetOperationalStatus.PENDING_DISPOSAL.value
Disposed = AssetOperationalStatus.DISPOSED.value


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _asset_row(*, status=Ready, version=1):
    return SimpleNamespace(
        id=uuid4(),
        operational_status=status,
        version=version,
        updated_at=None,
        updated_by=None,
    )


@pytest.mark.parametrize(
    ("action", "current", "expected_event"),
    [
        ("assign", "assign", OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED),
        ("return_to_ready", "return_to_ready", OperationalStatusAuditEvent.ASSIGNMENT_RETURNED),
        ("retire", "retire", OperationalStatusAuditEvent.RETIRED),
        ("complete_disposal", "complete_disposal", OperationalStatusAuditEvent.DISPOSED),
    ],
)
def test_audit_event_for_action(action: str, current: str, expected_event: str) -> None:
    assert audit_event_for_action(action) == expected_event


def test_log_operational_status_change_writes_audit_fields() -> None:
    audit = MagicMock()
    ctx = _ctx()
    asset_id = uuid4()
    log_operational_status_change(
        audit,
        ctx,
        asset_id,
        old_status=Ready,
        new_status=Assigned,
        action="assign",
        reason="assignment_activate",
        remarks="note",
    )
    audit.log_entity_change.assert_called_once()
    kwargs = audit.log_entity_change.call_args.kwargs
    assert kwargs["operation"] == OperationalStatusAuditEvent.OPERATIONAL_STATUS_CHANGED
    assert kwargs["old_value"]["operational_status"] == Ready
    assert kwargs["new_value"]["operational_status"] == Assigned
    assert kwargs["old_value"]["reason"] == "assignment_activate"
    assert kwargs["old_value"]["remarks"] == "note"
    assert "timestamp" in kwargs["old_value"]


def test_apply_action_audits_after_persist() -> None:
    service = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    row = _asset_row(status=Ready, version=2)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row) as set_status,
        patch.object(service._audit, "log_entity_change") as audit_log,
    ):
        result = service.apply_action(ctx, asset_id, action="assign", expected_version=2)
    assert result == Assigned
    set_status.assert_called_once()
    audit_log.assert_called_once()


def test_apply_action_version_conflict() -> None:
    service = AssetOperationalStatusService(MagicMock())
    row = _asset_row(status=Ready, version=5)
    with patch.object(service._repo, "lock_for_update", return_value=row):
        with pytest.raises(OperationalStatusConflict):
            service.apply_action(_ctx(), row.id, action="assign", expected_version=1)


def test_initialize_ready_to_move_sets_null_status() -> None:
    service = AssetOperationalStatusService(MagicMock())
    ctx = _ctx()
    row = _asset_row(status=None, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row),
        patch.object(service._audit, "log_entity_change"),
    ):
        assert service.initialize_ready_to_move(ctx, row.id) == Ready


def test_initialize_ready_to_move_idempotent() -> None:
    service = AssetOperationalStatusService(MagicMock())
    row = _asset_row(status=Ready, version=1)
    with patch.object(service._repo, "lock_for_update", return_value=row):
        assert service.initialize_ready_to_move(_ctx(), row.id) == Ready


@patch("modules.asset.service.assignment_service.asset_workflow_governance_enabled", return_value=False)
def test_activate_assignment_calls_operational_assign(_gov) -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    assignment = SimpleNamespace(
        id=row_id,
        status="submitted",
        workflow_instance_id=None,
        workflow_status=None,
        created_by=uuid4(),
        asset_id=asset_id,
        company_id=ctx.company_id,
        allocation_type="employee",
        employee_id=uuid4(),
        department_id=None,
        project_id=None,
        branch_id=ctx.branch_id,
    )
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        master_asset_id=None,
        version=3,
        custodian_employee_id=None,
    )

    with patch.object(svc, "get", return_value=assignment):
        with patch.object(svc._assets, "get", return_value=asset):
            with patch.object(svc._validator, "validate_activate_readiness", return_value=None):
                with patch.object(svc._assets, "update", return_value=asset):
                    with patch.object(svc._repo, "update", return_value=assignment):
                        with patch.object(svc._operational, "apply_action", return_value=Assigned) as ops:
                            with patch.object(svc._audit, "log_entity_change"):
                                svc._activate_assignment(ctx, row_id)
    ops.assert_called_once()
    assert ops.call_args.kwargs["action"] == "assign"
    assert ops.call_args.kwargs["expected_version"] == 3


@pytest.mark.parametrize(
    ("condition", "action"),
    [
        ("good", "return_to_ready"),
        ("outdated", "retire"),
        ("dead", "mark_pending_disposal"),
    ],
)
def test_return_assignment_operational_action(condition: str, action: str) -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="active",
        asset_id=asset_id,
        allocation_type="employee",
        employee_id=uuid4(),
    )
    asset = SimpleNamespace(id=asset_id, version=2, custodian_employee_id=row.employee_id, master_asset_id=None)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_return_readiness", return_value=None):
            with patch.object(svc._assets, "lock_for_update", return_value=asset):
                with patch.object(svc._operational, "apply_action", return_value=Ready) as ops:
                    with patch.object(svc._assets, "update", return_value=asset):
                        with patch.object(svc._repo, "complete_return", return_value=row):
                            with patch.object(svc._audit, "log_entity_change"):
                                svc.return_assignment(ctx, row_id, return_condition=condition)
    assert ops.call_args.kwargs["action"] == action


def test_return_assignment_ops_failure_blocks_assignment_return() -> None:
    svc = AssignmentService(MagicMock())
    row = SimpleNamespace(
        id=uuid4(),
        status="active",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
    )
    asset = SimpleNamespace(id=row.asset_id, version=1)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_return_readiness", return_value=None):
            with patch.object(svc._assets, "lock_for_update", return_value=asset):
                with patch.object(svc._operational, "apply_action", side_effect=InvalidTransition("x")):
                    with patch.object(svc._engine, "return_assignment") as ret:
                        with pytest.raises(InvalidTransition):
                            svc.return_assignment(ctx=_ctx(), row_id=row.id, return_condition="good")
                        ret.assert_not_called()


@patch("modules.asset.service.disposal_service.asset_workflow_governance_enabled", return_value=True)
def test_disposal_post_calls_complete_disposal(_gov) -> None:
    svc = DisposalService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    journal_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        asset_id=asset_id,
        status="approved",
        disposal_type="scrap",
        book_value_at_disposal=10,
        proceeds_amount=None,
        version=1,
    )
    claimed = SimpleNamespace(**{**row.__dict__, "version": 2})
    posted = SimpleNamespace(
        id=claimed.id,
        asset_id=claimed.asset_id,
        status="posted",
        finance_journal_id=journal_id,
        version=3,
    )
    asset = SimpleNamespace(id=asset_id, status="active", master_asset_id=None, version=4)

    def _repo_update(_ctx, _id, **fields):
        if "finance_journal_id" in fields:
            return posted
        return claimed

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(svc._finance, "post_disposal", return_value=journal_id):
                with patch.object(svc._repo, "update", side_effect=_repo_update):
                    with patch.object(svc._assets, "get", return_value=asset):
                        with patch.object(svc._asset_engine, "dispose"):
                            with patch.object(svc._assets, "update", return_value=asset):
                                with patch.object(
                                    svc._operational, "apply_action", return_value=Disposed
                                ) as ops:
                                    with patch.object(svc._audit, "log_entity_change"):
                                        svc.post(ctx, row_id, debit_account_id=uuid4(), credit_account_id=uuid4())
    ops.assert_called_once()
    assert ops.call_args.kwargs["action"] == "complete_disposal"


def test_workflow_ownership_assignment_uses_operational_service() -> None:
    import inspect

    import modules.asset.service.assignment_service as assignment_mod

    assignment_src = inspect.getsource(assignment_mod)
    assert "_operational.apply_action" in assignment_src
    assert "operational_status =" not in assignment_src


@pytest.mark.parametrize(
    ("current", "action", "expected"),
    [
        (Ready, "assign", Assigned),
        (Assigned, "return_to_ready", Ready),
        (Assigned, "retire", Retired),
        (Assigned, "mark_pending_disposal", Pending),
        (Pending, "complete_disposal", Disposed),
    ],
)
def test_service_apply_action_end_to_end_mocked(current: str, action: str, expected: str) -> None:
    service = AssetOperationalStatusService(MagicMock())
    row = _asset_row(status=current, version=1)
    with (
        patch.object(service._repo, "lock_for_update", return_value=row),
        patch.object(service._repo, "set_operational_status", return_value=row),
        patch.object(service._audit, "log_entity_change"),
    ):
        assert service.apply_action(_ctx(), row.id, action=action) == expected
