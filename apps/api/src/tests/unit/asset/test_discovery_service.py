"""Unit tests for DiscoveryValidator and AssetDiscoveryService (CR-003)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import DiscoveryValidationError
from modules.asset.service.discovery_service import AssetDiscoveryService
from modules.asset.service.discovery_validator import DiscoveryValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


SAMPLE = "HOSTNAME=PC1\nSERIAL=S1\nOS_NAME=Linux\nCPU=x\nRAM_GB=8\nMAC=aabbccddeeff\n"


def test_validator_rejects_oversized_raw() -> None:
    validator = DiscoveryValidator(MagicMock())
    with pytest.raises(DiscoveryValidationError, match="256KB"):
        validator.validate_raw_output("x" * (256 * 1024 + 1))


def test_validator_blocks_forbidden_fields() -> None:
    validator = DiscoveryValidator(MagicMock())
    with pytest.raises(DiscoveryValidationError, match="cannot be updated"):
        validator.validate_apply_fields({"purchase_cost": 1, "version": 1})


def test_validator_blocks_disposed_status() -> None:
    validator = DiscoveryValidator(MagicMock())
    with pytest.raises(DiscoveryValidationError, match="disposed"):
        validator.validate_apply_readiness(SimpleNamespace(status="disposed"))


def test_parse_does_not_persist() -> None:
    svc = AssetDiscoveryService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        serial_number=None,
        discovery_profile_json=None,
        status="active",
        company_id=ctx.company_id,
    )
    with patch.object(svc._assets, "get", return_value=asset):
        result = svc.parse(ctx, asset_id, platform="linux", raw_output=SAMPLE)
    assert result.persisted is False
    assert result.profile["device"]["hostname"] == "PC1"
    assert result.proposed_serial_number == "S1"


def test_apply_requires_preview_confirmed() -> None:
    svc = AssetDiscoveryService(MagicMock())
    ctx = _ctx()
    with pytest.raises(DiscoveryValidationError, match="preview_confirmed"):
        svc.apply(
            ctx,
            uuid4(),
            platform="linux",
            raw_output=SAMPLE,
            version=1,
            preview_confirmed=False,
        )


def test_apply_calls_asset_service_only() -> None:
    svc = AssetDiscoveryService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        serial_number=None,
        discovery_profile_json=None,
        status="active",
        company_id=ctx.company_id,
        version=1,
    )
    updated = SimpleNamespace(
        id=asset_id,
        version=2,
        serial_number="S1",
        discovery_profile_json={"device": {"serial_number": "S1"}},
    )
    with (
        patch.object(svc._assets, "get", return_value=asset),
        patch.object(svc._assets, "apply_discovery_profile", return_value=updated) as apply,
    ):
        result = svc.apply(
            ctx,
            asset_id,
            platform="linux",
            raw_output=SAMPLE,
            version=1,
            preview_confirmed=True,
        )
    apply.assert_called_once()
    kwargs = apply.call_args.kwargs
    assert "purchase_cost" not in kwargs
    assert kwargs["serial_number"] == "S1"
    assert result.applied is True
    assert result.version == 2
