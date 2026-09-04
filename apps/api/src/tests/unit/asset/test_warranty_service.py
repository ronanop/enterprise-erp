"""Unit tests for WarrantyService (FP-ASSET-009)."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import WarrantyValidationError
from modules.asset.service.warranty_service import WarrantyService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_sets_draft_status() -> None:
    svc = WarrantyService(MagicMock())
    ctx = _ctx()
    created = SimpleNamespace(
        id=uuid4(),
        asset_id=uuid4(),
        warranty_type="manufacturer",
        status="draft",
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change"),
    ):
        row = svc.create(
            ctx,
            asset_id=created.asset_id,
            warranty_type="manufacturer",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
        )
    assert row.status == "draft"
    assert create.call_args.kwargs["status"] == "draft"


def test_activate_claims_then_transitions() -> None:
    svc = WarrantyService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    draft = SimpleNamespace(id=row_id, status="draft", version=1)
    claimed = SimpleNamespace(id=row_id, status="draft", version=2)
    active = SimpleNamespace(id=row_id, status="active", version=3)
    with (
        patch.object(svc, "get", return_value=draft),
        patch.object(svc._validator, "validate_activate_readiness"),
        patch.object(svc._repo, "update", side_effect=[claimed, active]),
        patch.object(svc._engine, "activate") as activate,
        patch.object(svc._audit, "log_entity_change"),
    ):
        result = svc.activate(ctx, row_id)
    activate.assert_called_once_with(claimed)
    assert result.status == "active"


def test_extend_updates_end_date() -> None:
    svc = WarrantyService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    active = SimpleNamespace(
        id=row_id,
        status="active",
        version=1,
        end_date=date(2027, 1, 1),
    )
    claimed = SimpleNamespace(
        id=row_id,
        status="active",
        version=2,
        end_date=date(2027, 1, 1),
    )
    extended = SimpleNamespace(
        id=row_id,
        status="extended",
        version=3,
        end_date=date(2028, 1, 1),
    )
    with (
        patch.object(svc, "get", return_value=active),
        patch.object(svc._validator, "validate_extend_readiness"),
        patch.object(svc._repo, "update", side_effect=[claimed, extended]),
        patch.object(svc._engine, "extend"),
        patch.object(svc._audit, "log_entity_change"),
    ):
        result = svc.extend(ctx, row_id, new_end_date=date(2028, 1, 1))
    assert result.end_date == date(2028, 1, 1)


def test_update_propagates_validator_error() -> None:
    svc = WarrantyService(MagicMock())
    row = SimpleNamespace(id=uuid4(), status="expired")
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(
            svc._validator,
            "validate_update_fields",
            side_effect=WarrantyValidationError("Only draft or active"),
        ),
    ):
        with pytest.raises(WarrantyValidationError, match="draft or active"):
            svc.update(_ctx(), row.id, coverage_notes="x", version=1)
