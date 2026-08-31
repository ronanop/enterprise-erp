"""Unit tests for AssetService.apply_discovery_profile (CR-003)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import DiscoveryValidationError
from modules.asset.service.asset_service import AssetService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_apply_discovery_profile_audits() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(id=row_id, company_id=ctx.company_id, status="active", version=1)
    updated = SimpleNamespace(id=row_id, version=2, discovery_profile_json={"a": 1}, serial_number="S")
    with (
        patch.object(svc, "get", return_value=row),
        patch.object(svc._repo, "update", return_value=updated) as update,
        patch.object(svc._audit, "log_entity_change") as audit,
        patch(
            "modules.asset.service.discovery_validator.DiscoveryValidator.validate_serial_unique",
            return_value=None,
        ),
    ):
        result = svc.apply_discovery_profile(
            ctx,
            row_id,
            profile={"device": {"serial_number": "S"}},
            serial_number="S",
            version=1,
        )
    update.assert_called_once()
    assert update.call_args.kwargs["discovery_profile_json"]["device"]["serial_number"] == "S"
    assert "purchase_cost" not in update.call_args.kwargs
    audit.assert_called_once()
    assert audit.call_args.kwargs["operation"] == "discovery_apply"
    assert result.version == 2


def test_apply_discovery_rejects_disposed() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    row = SimpleNamespace(id=row_id, company_id=ctx.company_id, status="disposed", version=1)
    with patch.object(svc, "get", return_value=row):
        with pytest.raises(DiscoveryValidationError, match="disposed"):
            svc.apply_discovery_profile(
                ctx,
                row_id,
                profile={},
                serial_number=None,
                version=1,
            )
