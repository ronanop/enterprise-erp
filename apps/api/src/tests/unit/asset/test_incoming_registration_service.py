"""Unit tests for Incoming Registration Queue (Sub-phase 3)."""

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException, NotFoundException
from modules.asset.domain.enums import IncomingAssetUnitQcStatus, IncomingRegistrationStatus
from modules.asset.repository.incoming_asset_repository import compute_line_registration_status
from modules.asset.service.incoming_registration_service import IncomingRegistrationService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_compute_line_registration_status() -> None:
    assert (
        compute_line_registration_status(accepted=10, registered=0)
        == IncomingRegistrationStatus.PENDING_REGISTRATION.value
    )
    assert (
        compute_line_registration_status(accepted=10, registered=3)
        == IncomingRegistrationStatus.PARTIALLY_REGISTERED.value
    )
    assert (
        compute_line_registration_status(accepted=10, registered=10)
        == IncomingRegistrationStatus.REGISTERED.value
    )


def test_assert_unit_registrable_rejects_pending_qc() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    line = SimpleNamespace(id=uuid4(), branch_id=ctx.branch_id, is_deleted=False)
    unit = SimpleNamespace(
        qc_status=IncomingAssetUnitQcStatus.PENDING_QC.value,
        registered_asset_id=None,
        incoming_line=line,
    )
    with patch.object(svc._scope, "validate_branch_access"):
        with pytest.raises(ConflictException, match="ACCEPTED"):
            svc.assert_unit_registrable(ctx, unit)


def test_assert_unit_registrable_rejects_rejected() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    line = SimpleNamespace(id=uuid4(), branch_id=ctx.branch_id, is_deleted=False)
    unit = SimpleNamespace(
        qc_status=IncomingAssetUnitQcStatus.REJECTED.value,
        registered_asset_id=None,
        incoming_line=line,
    )
    with patch.object(svc._scope, "validate_branch_access"):
        with pytest.raises(ConflictException, match="ACCEPTED"):
            svc.assert_unit_registrable(ctx, unit)


def test_assert_unit_registrable_rejects_duplicate() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    line = SimpleNamespace(id=uuid4(), branch_id=ctx.branch_id, is_deleted=False)
    unit = SimpleNamespace(
        qc_status=IncomingAssetUnitQcStatus.ACCEPTED.value,
        registered_asset_id=uuid4(),
        incoming_line=line,
    )
    with patch.object(svc._scope, "validate_branch_access"):
        with pytest.raises(ConflictException, match="already registered"):
            svc.assert_unit_registrable(ctx, unit)


def test_prefill_from_incoming() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    unit_id = uuid4()
    line_id = uuid4()
    grn_id = uuid4()
    line = SimpleNamespace(
        id=line_id,
        branch_id=ctx.branch_id,
        is_deleted=False,
        grn_id=grn_id,
        grn_line_id=uuid4(),
        grn_document_number="GRN-1",
        purchase_order_id=uuid4(),
        po_document_number="PO-1",
        product_id=uuid4(),
        vendor_id=uuid4(),
        product_name="Dell Laptop",
        product_code="LAP",
        document_date=date(2026, 8, 1),
        quality_inspection_id=None,
    )
    unit = SimpleNamespace(
        id=unit_id,
        unit_index=1,
        serial_number="SN-1",
        qc_status=IncomingAssetUnitQcStatus.ACCEPTED.value,
        registered_asset_id=None,
        quality_inspection_id=None,
        incoming_line=line,
    )
    with (
        patch.object(svc._repo, "get_unit", return_value=unit),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(
            svc._assets._procurement,
            "get_grn",
            side_effect=NotFoundException("skip"),
        ),
    ):
        data = svc.prefill_from_incoming(ctx, incoming_unit_id=unit_id, incoming_line_id=line_id)
    assert data["asset_name"] == "Dell Laptop"
    assert data["serial_number"] == "SN-1"
    assert data["grn_document_number"] == "GRN-1"
    assert data["registration_status"] == IncomingRegistrationStatus.PENDING_REGISTRATION.value


def test_validate_excel_duplicate_unit_id() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    uid = str(uuid4())
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc, "_materialize_company_accepted"),
        patch.object(svc._repo, "get_unit", return_value=None),
    ):
        rows = svc.validate_excel_rows(
            ctx,
            [
                {
                    "incoming_unit_id": uid,
                    "asset_name": "A",
                    "branch_id": str(ctx.branch_id),
                    "asset_category_id": str(uuid4()),
                    "asset_type": "fixed",
                    "purchase_date": "2026-08-01",
                    "purchase_cost": "100",
                    "currency_code": "INR",
                },
                {
                    "incoming_unit_id": uid,
                    "asset_name": "B",
                    "branch_id": str(ctx.branch_id),
                    "asset_category_id": str(uuid4()),
                    "asset_type": "fixed",
                    "purchase_date": "2026-08-01",
                    "purchase_cost": "100",
                    "currency_code": "INR",
                },
            ],
        )
    assert rows[1]["status"] == "error"
    assert any("Duplicate" in e for e in rows[1]["errors"])


def test_validate_excel_accepts_optional_make_model_location() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    unit_id = uuid4()
    category_id = uuid4()
    line = SimpleNamespace(
        id=uuid4(),
        branch_id=ctx.branch_id,
        is_deleted=False,
        grn_id=uuid4(),
        purchase_order_id=None,
        product_id=uuid4(),
        vendor_id=None,
        grn_document_number="GRN-1",
        po_document_number=None,
        quality_inspection_id=None,
    )
    unit = SimpleNamespace(
        id=unit_id,
        serial_number="SN-1",
        qc_status=IncomingAssetUnitQcStatus.ACCEPTED.value,
        registered_asset_id=None,
        quality_inspection_id=None,
        incoming_line=line,
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc, "_materialize_company_accepted"),
        patch.object(svc._repo, "get_unit", return_value=unit),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields"),
    ):
        rows = svc.validate_excel_rows(
            ctx,
            [
                {
                    "incoming_unit_id": str(unit_id),
                    "asset_name": "Laptop",
                    "serial_number": "SN-1",
                    "branch_id": str(ctx.branch_id),
                    "asset_category_id": str(category_id),
                    "asset_type": "fixed",
                    "purchase_date": "2026-08-01",
                    "purchase_cost": "100",
                    "currency_code": "INR",
                    "make": "Dell",
                    "model": "Latitude",
                    "configuration": "16GB",
                    "location": "Desk 1",
                }
            ],
        )
    assert rows[0]["status"] == "valid"
    assert rows[0]["make"] == "Dell"
    assert rows[0]["location"] == "Desk 1"


def test_validate_excel_without_new_columns_still_works() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    unit_id = uuid4()
    line = SimpleNamespace(
        id=uuid4(),
        branch_id=ctx.branch_id,
        is_deleted=False,
        grn_id=uuid4(),
        purchase_order_id=None,
        product_id=uuid4(),
        vendor_id=None,
        grn_document_number="GRN-1",
        po_document_number=None,
        quality_inspection_id=None,
    )
    unit = SimpleNamespace(
        id=unit_id,
        serial_number=None,
        qc_status=IncomingAssetUnitQcStatus.ACCEPTED.value,
        registered_asset_id=None,
        quality_inspection_id=None,
        incoming_line=line,
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc, "_materialize_company_accepted"),
        patch.object(svc._repo, "get_unit", return_value=unit),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields"),
    ):
        rows = svc.validate_excel_rows(
            ctx,
            [
                {
                    "incoming_unit_id": str(unit_id),
                    "asset_name": "Laptop",
                    "branch_id": str(ctx.branch_id),
                    "asset_category_id": str(uuid4()),
                    "asset_type": "fixed",
                    "purchase_date": "2026-08-01",
                    "purchase_cost": "100",
                }
            ],
        )
    assert rows[0]["status"] == "valid"
    assert rows[0]["make"] is None
    assert rows[0]["location"] is None


def test_validate_excel_serial_mismatch() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    unit_id = uuid4()
    line = SimpleNamespace(
        id=uuid4(),
        branch_id=ctx.branch_id,
        is_deleted=False,
        grn_id=uuid4(),
        purchase_order_id=None,
        product_id=uuid4(),
        vendor_id=None,
        quality_inspection_id=None,
        grn_document_number="GRN",
        po_document_number=None,
    )
    unit = SimpleNamespace(
        id=unit_id,
        serial_number="ABC001",
        qc_status=IncomingAssetUnitQcStatus.ACCEPTED.value,
        registered_asset_id=None,
        quality_inspection_id=None,
        incoming_line=line,
    )
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc, "_materialize_company_accepted"),
        patch.object(svc._repo, "get_unit", return_value=unit),
        patch.object(svc._scope, "validate_branch_access"),
    ):
        rows = svc.validate_excel_rows(
            ctx,
            [
                {
                    "incoming_unit_id": str(unit_id),
                    "asset_name": "Dell",
                    "serial_number": "ABC999",
                    "branch_id": str(ctx.branch_id),
                    "asset_category_id": str(uuid4()),
                    "asset_type": "fixed",
                    "purchase_date": "2026-08-01",
                    "purchase_cost": "10",
                    "currency_code": "INR",
                }
            ],
        )
    assert rows[0]["status"] == "error"
    assert any("Serial mismatch" in e for e in rows[0]["errors"])


def test_confirm_requires_valid_rows() -> None:
    svc = IncomingRegistrationService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc, "validate_excel_rows", return_value=[{"status": "error", "errors": ["x"]}]),
    ):
        with pytest.raises(ConflictException, match="No valid"):
            svc.confirm_excel_rows(ctx, [])
