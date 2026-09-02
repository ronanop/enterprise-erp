"""Unit tests for ChecklistValidator (FP-ASSET-014)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import ChecklistValidationError
from modules.asset.service.checklist_validator import ChecklistValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_parent_link() -> None:
    validator = ChecklistValidator(MagicMock())
    with patch.object(validator._checklists, "find_by_code", return_value=None):
        with pytest.raises(ChecklistValidationError, match="At least one"):
            validator.validate_create_fields(
                _ctx(),
                company_id=uuid4(),
                fields={
                    "checklist_code": "CHK-001",
                    "checklist_name": "Safety",
                },
            )


def test_create_requires_code_and_name() -> None:
    validator = ChecklistValidator(MagicMock())
    with pytest.raises(ChecklistValidationError, match="checklist_code"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "checklist_name": "Safety"},
        )


def test_create_rejects_status_override() -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._checklists, "find_by_code", return_value=None):
            with pytest.raises(ChecklistValidationError, match="draft status"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "checklist_code": "CHK-001",
                        "checklist_name": "Safety",
                        "status": "completed",
                    },
                )


def test_create_blocks_disposed_asset() -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._checklists, "find_by_code", return_value=None):
            with pytest.raises(ChecklistValidationError, match="disposed"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "checklist_code": "CHK-001",
                        "checklist_name": "Safety",
                    },
                )


def test_create_requires_unique_code() -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._checklists, "find_by_code", return_value=SimpleNamespace()):
            with pytest.raises(ChecklistValidationError, match="unique"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "checklist_code": "CHK-001",
                        "checklist_name": "Safety",
                    },
                )


def test_complete_requires_required_item_results() -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        status="draft",
        company_id=ctx.company_id,
        asset_id=uuid4(),
        maintenance_id=None,
        audit_id=None,
        items_json={"items": [{"label": "Inspect belt", "required": True}]},
    )
    asset = SimpleNamespace(id=row.asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(ChecklistValidationError, match="requires a result"):
            validator.validate_complete_readiness(ctx, row)


def test_update_blocks_terminal_status() -> None:
    validator = ChecklistValidator(MagicMock())
    row = SimpleNamespace(
        status="completed",
        company_id=uuid4(),
        asset_id=uuid4(),
        maintenance_id=None,
        audit_id=None,
        items_json=None,
    )
    with pytest.raises(ChecklistValidationError, match="Only draft"):
        validator.validate_update_fields(_ctx(), row, {"checklist_name": "Updated"})


@pytest.mark.parametrize("user_type", ["employee", "tenant_admin", "super_admin"])
def test_create_rejects_asset_company_mismatch(user_type: str) -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type=user_type,
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    asset_id = uuid4()
    other_company_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=other_company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._checklists, "find_by_code", return_value=None):
            with pytest.raises(ChecklistValidationError, match="does not belong to this company"):
                validator.validate_create_fields(
                    ctx,
                    company_id=ctx.company_id,
                    fields={
                        "asset_id": asset_id,
                        "checklist_code": "CHK-001",
                        "checklist_name": "Safety",
                    },
                )


def test_create_allows_matching_asset_company() -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._checklists, "find_by_code", return_value=None):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "checklist_code": "CHK-001",
                    "checklist_name": "Safety",
                },
            )


@pytest.mark.parametrize("user_type", ["employee", "tenant_admin", "super_admin"])
def test_update_rejects_asset_company_mismatch(user_type: str) -> None:
    validator = ChecklistValidator(MagicMock())
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type=user_type,
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    asset_id = uuid4()
    row = SimpleNamespace(
        status="draft",
        company_id=ctx.company_id,
        asset_id=asset_id,
        maintenance_id=None,
        audit_id=None,
        items_json=None,
    )
    asset = SimpleNamespace(id=asset_id, company_id=uuid4(), status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(ChecklistValidationError, match="does not belong to this company"):
            validator.validate_update_fields(ctx, row, {"checklist_name": "Updated"})
