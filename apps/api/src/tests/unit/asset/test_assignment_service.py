"""AssignmentService lifecycle tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import InvalidAssetWorkflowState
from modules.asset.service.assignment_service import AssignmentService
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


def _assignment_row():
    return SimpleNamespace(
        id=uuid4(),
        status="draft",
        workflow_instance_id=None,
        workflow_status=None,
        created_by=uuid4(),
        asset_id=uuid4(),
        company_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        department_id=None,
        project_id=None,
        branch_id=uuid4(),
    )


def test_cancel_draft() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row = _assignment_row()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as mock_update:
            with patch.object(svc._audit, "log_entity_change", return_value=None):
                svc.cancel_draft(ctx, row.id)
                mock_update.assert_called_once()
                assert row.status == "cancelled"


def test_cancel_fails_after_workflow_started() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row = _assignment_row()
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.cancel_draft(ctx, row.id)


def test_reopen_clears_workflow_fields() -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    row = _assignment_row()
    row.status = "cancelled"
    row.workflow_status = WorkflowStatus.REJECTED.value
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as mock_update:
            with patch.object(svc._audit, "log_entity_change", return_value=None):
                svc.reopen(ctx, row.id)
                kwargs = mock_update.call_args.kwargs
                assert kwargs["workflow_status"] is None
                assert kwargs["workflow_instance_id"] is None


@patch("modules.asset.service.assignment_service.asset_workflow_governance_enabled", return_value=False)
def test_reject_disabled_when_governance_off(_flag) -> None:
    svc = AssignmentService(MagicMock())
    ctx = _ctx()
    with pytest.raises(InvalidAssetWorkflowState):
        svc.reject(ctx, uuid4())
