"""Sub-phase 4A — make/model/configuration + location on registration."""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.schemas import AssetCreate, AssetResponse, AssetUpdate
from modules.asset.service.asset_service import AssetService
from modules.asset.service.incoming_registration_service import TEMPLATE_HEADERS
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_asset_create_schema_accepts_registration_attrs() -> None:
    body = AssetCreate(
        branch_id=uuid4(),
        asset_name="Laptop",
        asset_category_id=uuid4(),
        asset_type="fixed",
        purchase_date=date.today(),
        purchase_cost=Decimal("1000"),
        currency_code="INR",
        make="Dell",
        model="Latitude",
        configuration="i7 · 16GB",
        location_label="Rack A",
    )
    dumped = body.model_dump(exclude_none=True)
    assert dumped["make"] == "Dell"
    assert dumped["model"] == "Latitude"
    assert dumped["configuration"] == "i7 · 16GB"
    assert dumped["location_label"] == "Rack A"


def test_asset_update_schema_accepts_registration_attrs() -> None:
    body = AssetUpdate(make="HP", model="", configuration=None, location_label="Floor 2")
    assert body.make == "HP"
    assert body.location_label == "Floor 2"


def test_asset_response_includes_registration_attrs() -> None:
    row = MagicMock()
    row.id = uuid4()
    row.document_number = "AST-1"
    row.asset_code = "AST-1"
    row.asset_name = "Laptop"
    row.asset_category_id = uuid4()
    row.asset_type = "fixed"
    row.master_asset_id = None
    row.product_id = None
    row.supplier_vendor_id = None
    row.serial_number = "SN-1"
    row.barcode = None
    row.qr_code = None
    row.rfid_tag = None
    row.make = "Dell"
    row.model = "XPS"
    row.configuration = "16GB"
    row.purchase_date = date.today()
    row.purchase_cost = Decimal("1")
    row.current_book_value = None
    row.salvage_value = None
    row.currency_code = "INR"
    row.depreciation_method = None
    row.useful_life_months = None
    row.department_id = None
    row.custodian_employee_id = None
    row.purchase_order_id = None
    row.grn_id = None
    row.inventory_receipt_id = None
    row.inventory_issue_id = None
    row.project_id = None
    row.production_order_id = None
    row.quality_inspection_id = None
    row.is_shared = False
    row.status = "draft"
    row.operational_status = None
    row.workflow_status = None
    row.workflow_instance_id = None
    row.company_id = uuid4()
    row.branch_id = uuid4()
    row.version = 1
    row.discovery_profile_json = None
    row.current_location_label = None
    resp = AssetResponse.model_validate(row)
    assert resp.make == "Dell"
    assert resp.model == "XPS"
    assert resp.configuration == "16GB"
    assert resp.current_location_label is None


def test_create_normalizes_empty_strings_and_persists_location() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    branch_id = ctx.branch_id
    company_id = ctx.company_id
    created = MagicMock()
    created.id = uuid4()
    created.branch_id = branch_id
    created.company_id = company_id

    with (
        patch.object(svc._scope, "resolve_company_id", return_value=company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._numbers, "generate", return_value="AST-DOC-1"),
        patch.object(svc._repo, "create", return_value=created) as mock_create,
        patch.object(svc._audit, "log_entity_change"),
        patch(
            "modules.asset.service.location_service.LocationService.create",
            return_value=MagicMock(location_label="Lab 1"),
        ) as mock_loc,
    ):
        row = svc.create(
            ctx,
            branch_id=branch_id,
            company_id=company_id,
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("10"),
            currency_code="INR",
            make="  ",
            model="T14",
            configuration="",
            location_label="Lab 1",
        )
        kwargs = mock_create.call_args.kwargs
        assert kwargs.get("make") is None
        assert kwargs.get("model") == "T14"
        assert kwargs.get("configuration") is None
        assert "location_label" not in kwargs
        mock_loc.assert_called_once()
        assert getattr(row, "current_location_label") == "Lab 1"


def test_create_skips_location_when_blank() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    created = MagicMock()
    created.id = uuid4()

    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._numbers, "generate", return_value="AST-DOC-2"),
        patch.object(svc._repo, "create", return_value=created),
        patch.object(svc._audit, "log_entity_change"),
        patch(
            "modules.asset.service.location_service.LocationService.create"
        ) as mock_loc,
    ):
        svc.create(
            ctx,
            branch_id=ctx.branch_id,
            company_id=ctx.company_id,
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("10"),
            currency_code="INR",
            location_label="  ",
        )
        mock_loc.assert_not_called()


def test_create_propagates_location_failure() -> None:
    db = MagicMock()
    svc = AssetService(db)
    ctx = _ctx()
    created = MagicMock()
    created.id = uuid4()

    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._numbers, "generate", return_value="AST-DOC-3"),
        patch.object(svc._repo, "create", return_value=created),
        patch.object(svc._audit, "log_entity_change"),
        patch(
            "modules.asset.service.location_service.LocationService.create",
            side_effect=RuntimeError("location boom"),
        ),
        pytest.raises(RuntimeError, match="location boom"),
    ):
        svc.create(
            ctx,
            branch_id=ctx.branch_id,
            company_id=ctx.company_id,
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("10"),
            currency_code="INR",
            location_label="Desk 9",
        )


def test_registration_excel_template_includes_new_columns() -> None:
    assert "make" in TEMPLATE_HEADERS
    assert "model" in TEMPLATE_HEADERS
    assert "configuration" in TEMPLATE_HEADERS
    assert "location" in TEMPLATE_HEADERS
    # Existing columns preserved
    assert TEMPLATE_HEADERS[:9] == [
        "incoming_unit_id",
        "asset_name",
        "serial_number",
        "branch_id",
        "asset_category_id",
        "asset_type",
        "purchase_date",
        "purchase_cost",
        "currency_code",
    ]
