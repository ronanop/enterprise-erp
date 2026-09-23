"""Unit tests for AssetInformationPortalService (CR-002)."""

from datetime import date, datetime, timezone
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
        operational_status="READY_TO_MOVE",
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
    assert portal.self_service_path == f"/assets/information-portal/{asset_id}?from=qr"
    assert portal.operational_status == "READY_TO_MOVE"
    assert portal.status == "active"
    payload = portal.model_dump()
    assert "purchase_cost" not in payload
    assert "current_book_value" not in payload
    assert "workflow_status" not in payload
    assert "workflow_instance_id" not in payload
    assert "operational_status" in payload


def test_get_portal_includes_operational_status_when_set() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(
        id=asset_id,
        asset_code="AST-2",
        asset_name="Laptop",
        asset_category_id=uuid4(),
        supplier_vendor_id=None,
        product_id=None,
        serial_number=None,
        asset_type="fixed",
        status="submitted",
        operational_status="READY_TO_MOVE",
        company_id=ctx.company_id,
        discovery_profile_json=None,
        version=1,
    )
    with (
        patch.object(svc._assets, "get", return_value=asset),
        patch.object(svc._categories, "get", return_value=None),
        patch.object(svc, "_active_assignment", return_value=None),
        patch.object(svc, "_warranty_summary", return_value=None),
        patch.object(svc, "_insurance_summary", return_value=None),
    ):
        portal = svc.get_portal(ctx, asset_id)
    assert portal.status == "submitted"
    assert portal.operational_status == "READY_TO_MOVE"


def test_get_self_service_aliases_portal() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    expected = SimpleNamespace(asset_id=asset_id)
    with patch.object(svc, "get_portal", return_value=expected) as portal:
        result = svc.get_self_service(ctx, asset_id)
    portal.assert_called_once_with(ctx, asset_id)
    assert result is expected


def test_lifecycle_timeline_includes_create_assign_and_maintenance() -> None:
    svc = AssetInformationPortalService(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asn_id = uuid4()
    maint_id = uuid4()
    created = datetime(2026, 9, 1, 10, 0, tzinfo=timezone.utc)
    allocated = datetime(2026, 9, 5, 9, 0, tzinfo=timezone.utc)
    returned = datetime(2026, 9, 10, 17, 0, tzinfo=timezone.utc)
    maint_started = datetime(2026, 9, 12, 8, 0, tzinfo=timezone.utc)
    asset = SimpleNamespace(
        id=asset_id,
        company_id=ctx.company_id,
        asset_code="AST-1",
        asset_name="Laptop",
        created_at=created,
    )
    assignment = SimpleNamespace(
        id=asn_id,
        status="returned",
        document_number="ASN-1",
        allocation_type="employee",
        employee_id=uuid4(),
        manual_employee_name=None,
        allocated_at=allocated,
        returned_at=returned,
        created_at=allocated,
        assignment_remarks="Issued",
        return_remarks="Back to stock",
    )
    maintenance = SimpleNamespace(
        id=maint_id,
        status="completed",
        document_number="AMNT-1",
        maintenance_type="corrective",
        reason="Screen failure",
        created_at=maint_started,
        scheduled_date=None,
        completed_date=date(2026, 9, 14),
        updated_at=datetime(2026, 9, 14, 16, 0, tzinfo=timezone.utc),
    )
    with (
        patch.object(svc._assets, "get", return_value=asset),
        patch.object(svc._audit, "list_logs_for_entity", return_value=[]),
        patch.object(svc._assignments, "search", return_value=([assignment], 1)),
        patch.object(svc._maintenances, "search", return_value=([maintenance], 1)),
        patch.object(svc, "_assignee_label", return_value="E001 — Ada Lovelace"),
    ):
        events = svc.get_lifecycle_timeline(ctx, asset_id)

    kinds = [e.kind for e in events]
    assert "created" in kinds
    assert "assigned" in kinds
    assert "returned" in kinds
    assert "maintenance_started" in kinds
    assert "maintenance_completed" in kinds
    assigned = next(e for e in events if e.kind == "assigned")
    assert "Ada Lovelace" in assigned.title
    returned_ev = next(e for e in events if e.kind == "returned")
    assert "De-assigned" in returned_ev.title
    assert events[0].occurred_at >= events[-1].occurred_at


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
