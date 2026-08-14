"""Unit tests for LocationValidator (FP-ASSET-012)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import LocationValidationError
from modules.asset.service.location_validator import (
    ELIGIBLE_ASSET_STATUSES,
    LocationValidator,
)
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _assert_create_allowed(status: str) -> None:
    validator = LocationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status=status)
    with patch.object(validator._assets, "get", return_value=asset):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            fields={"asset_id": asset.id, "location_label": "Building A"},
        )


def test_create_requires_asset_id() -> None:
    validator = LocationValidator(MagicMock())
    with pytest.raises(LocationValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_requires_location_label() -> None:
    validator = LocationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(LocationValidationError, match="location_label"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id},
            )


@pytest.mark.parametrize(
    "status",
    sorted(ELIGIBLE_ASSET_STATUSES),
)
def test_create_allows_registration_and_live_statuses(status: str) -> None:
    """BUG-REG-LOC-01: draft/submitted/approved eligible for location (LOC-08)."""
    _assert_create_allowed(status)


@pytest.mark.parametrize(
    ("status", "match"),
    [
        ("disposed", "Disposed"),
        ("written_off", "written-off|Disposed"),
        ("cancelled", "Cancelled"),
    ],
)
def test_create_blocks_terminal_statuses(status: str, match: str) -> None:
    validator = LocationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status=status)
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(LocationValidationError, match=match):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "location_label": "Warehouse A"},
            )


def test_create_blocks_disposed_asset() -> None:
    validator = LocationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(LocationValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "location_label": "Warehouse A"},
            )


def test_create_rejects_cross_company_asset() -> None:
    validator = LocationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=uuid4(), status="draft")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(LocationValidationError, match="company"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={"asset_id": asset.id, "location_label": "Site"},
            )


def test_update_blocks_historical() -> None:
    validator = LocationValidator(MagicMock())
    row = SimpleNamespace(
        status="historical",
        asset_id=uuid4(),
        location_label="Old",
        effective_from=None,
        effective_to=None,
    )
    with pytest.raises(LocationValidationError, match="active"):
        validator.validate_update_fields(_ctx(), row, {})


def test_complete_requires_current() -> None:
    validator = LocationValidator(MagicMock())
    row = SimpleNamespace(status="active", is_current=False, asset_id=uuid4())
    asset = SimpleNamespace(id=row.asset_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(LocationValidationError, match="current"):
            validator.validate_complete_readiness(_ctx(), row)


def test_effective_date_order_on_update() -> None:
    from datetime import datetime, timezone

    validator = LocationValidator(MagicMock())
    row = SimpleNamespace(
        status="active",
        asset_id=uuid4(),
        location_label="Site",
        effective_from=datetime(2026, 2, 1, tzinfo=timezone.utc),
        effective_to=None,
    )
    asset = SimpleNamespace(id=row.asset_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(LocationValidationError, match="effective_from"):
            validator.validate_update_fields(
                _ctx(),
                row,
                {"effective_to": datetime(2026, 1, 1, tzinfo=timezone.utc)},
            )
