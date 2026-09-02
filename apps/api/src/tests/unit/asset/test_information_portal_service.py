"""Unit tests for AssetInformationPortalService (CR-002)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import NotFoundException
from modules.asset.service.information_portal_service import AssetInformationPortalService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_get_portal_uses_asset_service_and_redacts_finance() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        asset_code="AST-2026-000001",
        asset_name="Laptop",
        asset_category_id=uuid4(),
        supplier_vendor_id=None,
        product_id=None,
        serial_number="SN-1",
        asset_type="fixed",
        status="active",
        company_id=ctx.company_id,
        purchase_cost=9999,
        current_book_value=5000,
        workflow_status="approved",
        discovery_profile_json=None,
        version=3,
    )
    category = SimpleNamespace(category_code="IT", category_name="Information Technology")
    with (
        patch.object(svc._assets, "get", return_value=asset) as get_asset,
        patch.object(svc._categories, "get", return_value=category),
        patch.object(svc, "_active_assignment", return_value=None),
        patch.object(svc, "_warranty_summary", return_value=None),
        patch.object(svc, "_insurance_summary", return_value=None),
    ):
        portal = svc.get_portal(ctx, asset_id)

    get_asset.assert_called_once_with(ctx, asset_id)
    assert portal.asset_code == "AST-2026-000001"
    assert portal.category_code == "IT"
    assert portal.version == 3
    assert portal.self_service_path == f"/assets/self-service/{asset_id}"
    payload = portal.model_dump()
    assert "purchase_cost" not in payload
    assert "current_book_value" not in payload
    assert "workflow_status" not in payload
    assert "workflow_instance_id" not in payload


def test_get_self_service_aliases_portal() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    expected = SimpleNamespace(asset_id=asset_id)
    with patch.object(svc, "get_portal", return_value=expected) as portal:
        result = svc.get_self_service(ctx, asset_id)
    portal.assert_called_once_with(ctx, asset_id)
    assert result is expected


def test_missing_vendor_does_not_fail_portal() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    with patch.object(
        svc._master, "get_vendor", side_effect=NotFoundException("Vendor not found")
    ):
        assert svc._safe_vendor_name(ctx, uuid4()) is None


def test_portal_requires_asset_lookup() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    with patch.object(svc._assets, "get", side_effect=NotFoundException("Asset not found")):
        with pytest.raises(NotFoundException):
            svc.get_portal(ctx, uuid4())
