"""Unit tests for ChecklistService (FP-ASSET-014)."""

import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from core.exceptions import ConflictException
from modules.asset.domain.exceptions import ChecklistValidationError
from modules.asset.service.checklist_service import ChecklistService
from modules.foundation.domain.value_objects import TenantContext


def test_service_wires_validator_and_engine() -> None:
    svc = ChecklistService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None
    assert svc._audit is not None


def test_create_forces_draft_status() -> None:
    svc = ChecklistService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    created = MagicMock(status="draft", checklist_code="CHK-1", asset_id=uuid4())
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_create_fields", return_value=None),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        svc.create(
            ctx,
            asset_id=uuid4(),
            checklist_code="CHK-1",
            checklist_name="Safety",
            status="completed",
        )
        create.assert_called_once()
        assert create.call_args.kwargs["status"] == "draft"


def test_search_delegates_to_repository() -> None:
    svc = ChecklistService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "search", return_value=([], 0)) as search,
    ):
        svc.search(ctx, search="belt", offset=0, limit=25)
        search.assert_called_once()


def test_create_propagates_asset_company_validation() -> None:
    svc = ChecklistService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="tenant_admin",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(
            svc._validator,
            "validate_create_fields",
            side_effect=ChecklistValidationError("Asset does not belong to this company"),
        ),
    ):
        with pytest.raises(ChecklistValidationError, match="does not belong to this company"):
            svc.create(
                ctx,
                asset_id=uuid4(),
                checklist_code="CHK-1",
                checklist_name="Safety",
            )


def _draft_row() -> MagicMock:
    row = MagicMock()
    row.id = uuid4()
    row.status = "draft"
    row.version = 1
    row.company_id = uuid4()
    row.asset_id = uuid4()
    row.maintenance_id = None
    row.audit_id = None
    row.items_json = {"items": [{"label": "Inspect", "required": True, "result": "pass"}]}
    return row


def test_complete_claim_conflict_skips_engine() -> None:
    svc = ChecklistService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    row = _draft_row()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_complete_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._engine, "complete") as complete:
                    with pytest.raises(ConflictException):
                        svc.complete(ctx, row.id)
                    complete.assert_not_called()


def test_cancel_claim_conflict_skips_engine() -> None:
    svc = ChecklistService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    row = _draft_row()
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_cancel_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._engine, "cancel") as cancel:
                    with pytest.raises(ConflictException):
                        svc.cancel(ctx, row.id)
                    cancel.assert_not_called()
