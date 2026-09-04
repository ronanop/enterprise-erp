"""Unit tests for AssetAuditValidator (FP-ASSET-008)."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import AssetAuditValidationError
from modules.asset.service.asset_audit_validator import AssetAuditValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_asset_id() -> None:
    validator = AssetAuditValidator(MagicMock())
    with pytest.raises(AssetAuditValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_requires_auditor() -> None:
    validator = AssetAuditValidator(MagicMock())
    with pytest.raises(AssetAuditValidationError, match="auditor_employee_id"):
        validator.validate_create_fields(
            _ctx(), company_id=uuid4(), fields={"asset_id": uuid4()}
        )


def test_create_blocks_disposed_asset() -> None:
    validator = AssetAuditValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(AssetAuditValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "auditor_employee_id": uuid4()},
            )


def test_start_requires_audit_date() -> None:
    validator = AssetAuditValidator(MagicMock())
    row = SimpleNamespace(status="planned", audit_date=None, asset_id=uuid4())
    with pytest.raises(AssetAuditValidationError, match="audit_date"):
        validator.validate_start_readiness(_ctx(), row)


def test_complete_requires_found_status() -> None:
    validator = AssetAuditValidator(MagicMock())
    row = SimpleNamespace(
        status="in_progress",
        audit_date=date.today(),
        found_status=None,
        asset_id=uuid4(),
    )
    with pytest.raises(AssetAuditValidationError, match="found_status"):
        validator.validate_complete_readiness(_ctx(), row)


def test_update_rejects_non_planned_audit() -> None:
    validator = AssetAuditValidator(MagicMock())
    row = SimpleNamespace(status="in_progress", asset_id=uuid4())
    with pytest.raises(AssetAuditValidationError, match="planned"):
        validator.validate_update_fields(_ctx(), row, {})
