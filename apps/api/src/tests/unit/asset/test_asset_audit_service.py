"""Unit tests for AssetAuditService (FP-ASSET-008)."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.asset_audit_service import AssetAuditService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _completeable_row() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid4(),
        status="in_progress",
        version=1,
        found_status="found",
        audit_date=date.today(),
        asset_id=uuid4(),
    )


def test_complete_claim_conflict_skips_engine() -> None:
    svc = AssetAuditService(MagicMock())
    ctx = _ctx()
    row = _completeable_row()
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


def test_complete_succeeds_and_writes_audit_log() -> None:
    svc = AssetAuditService(MagicMock())
    ctx = _ctx()
    row = _completeable_row()
    claimed = SimpleNamespace(**{**row.__dict__, "version": 2})
    completed = SimpleNamespace(**{**claimed.__dict__, "status": "completed", "version": 3})

    def _update(_ctx, _row_id, **fields):
        return completed if "status" in fields else claimed

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_complete_readiness"):
            with patch.object(svc._repo, "update", side_effect=_update):
                with patch.object(svc._audit, "log_entity_change") as log_change:
                    result = svc.complete(ctx, row.id)

    assert result is completed
    assert claimed.status == "completed"
    log_change.assert_called_once()
    assert log_change.call_args.kwargs["operation"] == "complete"
