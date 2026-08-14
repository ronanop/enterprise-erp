"""TransferService lifecycle tests."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import InvalidAssetWorkflowState
from modules.asset.service.transfer_service import TransferService
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


def _transfer_row():
    return SimpleNamespace(
        id=uuid4(),
        status="draft",
        workflow_instance_id=None,
        workflow_status=None,
        created_by=uuid4(),
        asset_id=uuid4(),
        company_id=uuid4(),
        from_branch_id=uuid4(),
        to_branch_id=uuid4(),
        from_department_id=None,
        to_department_id=None,
        from_employee_id=None,
        to_employee_id=None,
        from_location_label=None,
        to_location_label=None,
        from_org_location_id=None,
        to_org_location_id=None,
    )


def test_cancel_draft() -> None:
    svc = TransferService(MagicMock())
    ctx = _ctx()
    row = _transfer_row()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as mock_update:
            svc.cancel_draft(ctx, row.id)
            mock_update.assert_called_once()
            assert row.status == "cancelled"


def test_cancel_fails_after_workflow_started() -> None:
    svc = TransferService(MagicMock())
    ctx = _ctx()
    row = _transfer_row()
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(InvalidAssetWorkflowState):
            svc.cancel_draft(ctx, row.id)


def test_reopen_clears_workflow_fields() -> None:
    svc = TransferService(MagicMock())
    ctx = _ctx()
    row = _transfer_row()
    row.status = "cancelled"
    row.workflow_status = WorkflowStatus.REJECTED.value
    row.workflow_instance_id = uuid4()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._repo, "update", return_value=row) as mock_update:
            svc.reopen(ctx, row.id)
            kwargs = mock_update.call_args.kwargs
            assert kwargs["workflow_status"] is None
            assert kwargs["workflow_instance_id"] is None
            assert row.status == "draft"


@patch("modules.asset.service.transfer_service.asset_workflow_governance_enabled", return_value=True)
def test_resubmit_reopens_then_submits(_flag) -> None:
    svc = TransferService(MagicMock())
    ctx = _ctx()
    row = _transfer_row()
    row.status = "cancelled"
    row.workflow_status = WorkflowStatus.REJECTED.value
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc, "reopen", return_value=row) as mock_reopen:
            with patch.object(svc, "submit", return_value=row) as mock_submit:
                svc.resubmit(ctx, row.id)
                mock_reopen.assert_called_once()
                mock_submit.assert_called_once()


@patch("modules.asset.service.transfer_service.asset_workflow_governance_enabled", return_value=True)
def test_submit_creates_workflow_instance(_flag) -> None:
    svc = TransferService(MagicMock())
    ctx = _ctx()
    row = _transfer_row()
    row.company_id = ctx.company_id
    instance = SimpleNamespace(id=uuid4())
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_submit_readiness"):
            with patch.object(svc._governance, "submit_for_approval", return_value=instance):
                with patch.object(svc._repo, "update", return_value=row) as mock_update:
                    svc.submit(ctx, row.id)
                    assert mock_update.call_args.kwargs["workflow_instance_id"] == instance.id


def test_create_repo_receives_validated_asset_id_once() -> None:
    """BUG-TRF-CREATE-01: body asset_id must not double-bind repository kwargs."""
    svc = TransferService(MagicMock())
    ctx = _ctx()
    branch_id = ctx.branch_id
    company_id = ctx.company_id
    request_asset_id = uuid4()
    validated_asset_id = uuid4()
    to_branch_id = uuid4()
    asset = SimpleNamespace(
        id=validated_asset_id,
        branch_id=branch_id,
        department_id=None,
        custodian_employee_id=None,
        company_id=company_id,
        status="active",
        operational_status="READY_TO_MOVE",
    )
    created = _transfer_row()
    created.asset_id = validated_asset_id
    created.document_number = "ATRF-1"

    with patch.object(svc._scope, "resolve_company_id", return_value=company_id):
        with patch.object(svc._scope, "validate_branch_access"):
            with patch.object(svc._validator, "validate_create_fields"):
                with patch.object(svc._assets, "get", return_value=asset) as mock_get:
                    with patch.object(svc._locations, "find_current", return_value=[]):
                        with patch.object(svc._numbers, "generate", return_value="ATRF-1"):
                            with patch.object(svc._repo, "create", return_value=created) as mock_create:
                                with patch.object(svc._audit, "log_entity_change"):
                                    svc.create(
                                        ctx,
                                        branch_id=branch_id,
                                        company_id=company_id,
                                        asset_id=request_asset_id,
                                        to_branch_id=to_branch_id,
                                        to_location_label="Dest Lab",
                                        reason="move",
                                        transfer_notes="note",
                                    )

    mock_get.assert_called_once_with(ctx, request_asset_id)
    kwargs = mock_create.call_args.kwargs
    assert kwargs["asset_id"] == validated_asset_id
    assert kwargs["asset_id"] != request_asset_id
    assert kwargs["company_id"] == company_id
    assert kwargs["branch_id"] == branch_id
    assert kwargs["to_branch_id"] == to_branch_id
    assert kwargs["to_location_label"] == "Dest Lab"
    assert kwargs["reason"] == "move"
    assert kwargs["transfer_notes"] == "note"
    assert kwargs["status"] == "draft"
    assert kwargs["document_number"] == "ATRF-1"


def test_create_company_id_in_fields_does_not_duplicate_kwarg() -> None:
    """company_id in **fields must not collide with explicit company_id=cid on repo.create."""
    svc = TransferService(MagicMock())
    ctx = _ctx()
    branch_id = ctx.branch_id
    company_id = ctx.company_id
    other_company = uuid4()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        branch_id=branch_id,
        department_id=None,
        custodian_employee_id=None,
        company_id=company_id,
        status="active",
        operational_status="READY_TO_MOVE",
    )
    created = _transfer_row()
    created.asset_id = asset_id
    created.document_number = "ATRF-2"

    def _inject_company_id(_ctx, *, company_id, fields):  # noqa: ARG001
        fields["company_id"] = other_company

    with patch.object(svc._scope, "resolve_company_id", return_value=company_id):
        with patch.object(svc._scope, "validate_branch_access"):
            with patch.object(svc._validator, "validate_create_fields", side_effect=_inject_company_id):
                with patch.object(svc._assets, "get", return_value=asset):
                    with patch.object(svc._locations, "find_current", return_value=[]):
                        with patch.object(svc._numbers, "generate", return_value="ATRF-2"):
                            with patch.object(svc._repo, "create", return_value=created) as mock_create:
                                with patch.object(svc._audit, "log_entity_change"):
                                    svc.create(
                                        ctx,
                                        branch_id=branch_id,
                                        company_id=company_id,
                                        asset_id=asset_id,
                                        to_location_label="B",
                                    )

    assert mock_create.call_args.kwargs["company_id"] == company_id
    assert mock_create.call_args.kwargs["company_id"] != other_company
    assert mock_create.call_args.kwargs["to_location_label"] == "B"
    assert mock_create.call_args.kwargs["asset_id"] == asset_id
