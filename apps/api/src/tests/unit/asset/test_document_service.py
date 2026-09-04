"""Unit tests for DocumentService (FP-ASSET-016)."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.document_service import DocumentService
from modules.foundation.domain.value_objects import TenantContext


def test_service_wires_validator_and_engine() -> None:
    svc = DocumentService(MagicMock())
    assert svc._validator is not None
    assert svc._engine is not None


def test_create_forces_active_status() -> None:
    svc = DocumentService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    created = MagicMock(status="active", asset_id=uuid4())
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_create_fields", return_value=None),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        svc.create(
            ctx,
            asset_id=uuid4(),
            document_type="invoice",
            document_name="INV-1",
            status="archived",
        )
        assert create.call_args.kwargs["status"] == "active"


def test_supersede_claim_conflict_skips_engine() -> None:
    svc = DocumentService(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    row = MagicMock(id=uuid4(), status="active", version=1)
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_supersede_readiness"):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._engine, "supersede") as supersede:
                    with pytest.raises(ConflictException):
                        svc.supersede(ctx, row.id)
                    supersede.assert_not_called()
