"""Unit tests for AssetCategoryService (CR-001)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import CategoryValidationError, InvalidAssetCategoryState
from modules.asset.service.asset_category_service import AssetCategoryService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_sets_active_status() -> None:
    svc = AssetCategoryService(MagicMock())
    ctx = _ctx()
    created = SimpleNamespace(id=uuid4(), status="active", category_code="IT")
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change"),
    ):
        row = svc.create(ctx, category_code="IT", category_name="Information Technology")
    assert row.status == "active"
    assert create.call_args.kwargs["status"] == "active"
    assert create.call_args.kwargs["category_code"] == "IT"


def test_update_calls_validator_and_audit() -> None:
    svc = AssetCategoryService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    existing = SimpleNamespace(id=row_id, version=1, category_code="IT")
    updated = SimpleNamespace(id=row_id, version=2, category_name="Updated")
    with (
        patch.object(svc, "get", return_value=existing),
        patch.object(svc._validator, "validate_update_fields") as validate,
        patch.object(svc._repo, "update", return_value=updated),
        patch.object(svc._audit, "log_entity_change") as audit,
    ):
        result = svc.update(ctx, row_id, category_name="Updated", version=1)
    validate.assert_called_once()
    audit.assert_called_once()
    assert result.category_name == "Updated"


def test_deactivate_guards_then_transitions() -> None:
    svc = AssetCategoryService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    active = SimpleNamespace(id=row_id, status="active", version=1)
    claimed = SimpleNamespace(id=row_id, status="active", version=2)
    inactive = SimpleNamespace(id=row_id, status="inactive", version=3)
    with (
        patch.object(svc, "get", return_value=active),
        patch.object(svc._validator, "validate_deactivate") as guard,
        patch.object(svc._repo, "update", side_effect=[claimed, inactive]),
        patch.object(svc._engine, "deactivate") as deactivate,
        patch.object(svc._audit, "log_entity_change"),
    ):
        result = svc.deactivate(ctx, row_id)
    guard.assert_called_once()
    deactivate.assert_called_once_with(claimed)
    assert result.status == "inactive"


def test_deactivate_propagates_validation_error() -> None:
    svc = AssetCategoryService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    active = SimpleNamespace(id=row_id, status="active", version=1)
    with (
        patch.object(svc, "get", return_value=active),
        patch.object(
            svc._validator,
            "validate_deactivate",
            side_effect=CategoryValidationError("Cannot deactivate"),
        ),
    ):
        with pytest.raises(CategoryValidationError, match="Cannot deactivate"):
            svc.deactivate(ctx, row_id)


def test_reactivate_transitions() -> None:
    svc = AssetCategoryService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    inactive = SimpleNamespace(id=row_id, status="inactive", version=1)
    claimed = SimpleNamespace(id=row_id, status="inactive", version=2)
    active = SimpleNamespace(id=row_id, status="active", version=3)
    with (
        patch.object(svc, "get", return_value=inactive),
        patch.object(svc._repo, "update", side_effect=[claimed, active]),
        patch.object(svc._engine, "activate") as activate,
        patch.object(svc._audit, "log_entity_change"),
    ):
        result = svc.reactivate(ctx, row_id)
    activate.assert_called_once_with(claimed)
    assert result.status == "active"


def test_reactivate_rejects_invalid_state() -> None:
    svc = AssetCategoryService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    active = SimpleNamespace(id=row_id, status="active", version=1)
    claimed = SimpleNamespace(id=row_id, status="active", version=2)
    with (
        patch.object(svc, "get", return_value=active),
        patch.object(svc._repo, "update", return_value=claimed),
        patch.object(
            svc._engine,
            "activate",
            side_effect=InvalidAssetCategoryState("Only inactive"),
        ),
    ):
        with pytest.raises(InvalidAssetCategoryState):
            svc.reactivate(ctx, row_id)
