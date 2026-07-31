"""Unit tests for ComponentValidator (FP-ASSET-019)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import ComponentValidationError
from modules.asset.service.component_validator import ComponentValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx(user_type: str = "employee") -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type=user_type,
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_install_requires_asset_id() -> None:
    validator = ComponentValidator(MagicMock())
    with pytest.raises(ComponentValidationError, match="asset_id"):
        validator.validate_install_fields(_ctx(), company_id=uuid4(), fields={})


def test_install_requires_component_code() -> None:
    validator = ComponentValidator(MagicMock())
    with pytest.raises(ComponentValidationError, match="component_code"):
        validator.validate_install_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "component_name": "Motor"},
        )


def test_install_requires_component_name() -> None:
    validator = ComponentValidator(MagicMock())
    with pytest.raises(ComponentValidationError, match="component_name"):
        validator.validate_install_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "component_code": "CMP-1"},
        )


def test_install_rejects_non_active_status() -> None:
    validator = ComponentValidator(MagicMock())
    with pytest.raises(ComponentValidationError, match="active status"):
        validator.validate_install_fields(
            _ctx(),
            company_id=uuid4(),
            fields={
                "asset_id": uuid4(),
                "component_code": "CMP-1",
                "component_name": "Motor",
                "status": "disposed",
            },
        )


def test_install_rejects_disposed_asset() -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id, company_id=ctx.company_id, status="disposed", branch_id=None
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(ComponentValidationError, match="disposed or written-off"):
            validator.validate_install_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "component_code": "CMP-1",
                    "component_name": "Motor",
                },
            )


@pytest.mark.parametrize("user_type", ["employee", "tenant_admin", "super_admin"])
def test_install_rejects_company_mismatch(user_type: str) -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx(user_type=user_type)
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id, company_id=uuid4(), status="active", branch_id=None
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(ComponentValidationError, match="does not belong to this company"):
            validator.validate_install_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "component_code": "CMP-1",
                    "component_name": "Motor",
                },
            )


def test_install_rejects_duplicate_active_code() -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id, company_id=ctx.company_id, status="active", branch_id=None
    )
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._components, "find_active_by_code", return_value=MagicMock()),
    ):
        with pytest.raises(ComponentValidationError, match="component_code already exists"):
            validator.validate_install_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "component_code": "CMP-1",
                    "component_name": "Motor",
                },
            )


def test_install_rejects_negative_quantity() -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id, company_id=ctx.company_id, status="active", branch_id=None
    )
    with (
        patch.object(validator._assets, "get", return_value=asset),
        patch.object(validator._components, "find_active_by_code", return_value=None),
        patch.object(validator._components, "find_active_by_serial", return_value=None),
    ):
        with pytest.raises(ComponentValidationError, match="quantity cannot be negative"):
            validator.validate_install_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "component_code": "CMP-1",
                    "component_name": "Motor",
                    "quantity": -1,
                },
            )


def test_update_rejects_immutable_fields() -> None:
    validator = ComponentValidator(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        status="active",
        asset_id=uuid4(),
        component_code="CMP-1",
        company_id=ctx.company_id,
    )
    asset = SimpleNamespace(id=row.asset_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(ComponentValidationError, match="component_code cannot be changed"):
            validator.validate_update_fields(
                ctx, row, {"component_code": "OTHER", "version": 1}
            )


def test_update_rejects_non_active() -> None:
    validator = ComponentValidator(MagicMock())
    row = SimpleNamespace(status="disposed", asset_id=uuid4(), component_code="CMP-1")
    with pytest.raises(ComponentValidationError, match="Only active"):
        validator.validate_update_fields(_ctx(), row, {"component_name": "X"})


def test_replace_readiness_requires_active() -> None:
    validator = ComponentValidator(MagicMock())
    row = SimpleNamespace(status="replaced", asset_id=uuid4())
    with pytest.raises(ComponentValidationError, match="Only active"):
        validator.validate_replace_readiness(_ctx(), row)


def test_dispose_readiness_requires_active() -> None:
    validator = ComponentValidator(MagicMock())
    row = SimpleNamespace(status="disposed", asset_id=uuid4())
    with pytest.raises(ComponentValidationError, match="Only active"):
        validator.validate_dispose_readiness(_ctx(), row)
