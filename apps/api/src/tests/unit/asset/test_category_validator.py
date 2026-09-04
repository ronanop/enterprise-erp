"""Unit tests for CategoryValidator (CR-001)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import CategoryValidationError
from modules.asset.service.category_validator import CategoryValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_validate_create_requires_code_and_name() -> None:
    validator = CategoryValidator(MagicMock())
    ctx = _ctx()
    with patch.object(validator._categories, "get_by_code", return_value=None):
        with pytest.raises(CategoryValidationError, match="category_code"):
            validator.validate_create_fields(ctx, ctx.company_id, {"category_name": "IT"})
        with pytest.raises(CategoryValidationError, match="category_name"):
            validator.validate_create_fields(ctx, ctx.company_id, {"category_code": "IT"})


def test_validate_create_rejects_duplicate_code() -> None:
    validator = CategoryValidator(MagicMock())
    ctx = _ctx()
    with patch.object(validator._categories, "get_by_code", return_value=SimpleNamespace(id=uuid4())):
        with pytest.raises(CategoryValidationError, match="already exists"):
            validator.validate_create_fields(
                ctx,
                ctx.company_id,
                {"category_code": "IT", "category_name": "Information Technology"},
            )


def test_validate_update_rejects_status_and_code_change() -> None:
    validator = CategoryValidator(MagicMock())
    row = SimpleNamespace(id=uuid4(), category_code="IT")
    with pytest.raises(CategoryValidationError, match="immutable"):
        validator.validate_update_fields(row, {"category_code": "OTHER"})
    with pytest.raises(CategoryValidationError, match="deactivate/reactivate"):
        validator.validate_update_fields(row, {"status": "inactive"})


def test_validate_deactivate_blocks_when_assets_reference() -> None:
    validator = CategoryValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(id=uuid4(), company_id=ctx.company_id)
    with patch.object(validator._assets, "count_operational_by_category", return_value=2):
        with pytest.raises(CategoryValidationError, match="operational asset"):
            validator.validate_deactivate(ctx, row)


def test_validate_deactivate_allows_when_no_references() -> None:
    validator = CategoryValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(id=uuid4(), company_id=ctx.company_id)
    with patch.object(validator._assets, "count_operational_by_category", return_value=0):
        validator.validate_deactivate(ctx, row)
