"""RegistrationValidator unit tests with mocked dependencies."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import (
    DuplicateAssetRegistrationError,
    RegistrationValidationError,
)
from modules.asset.service.registration_validator import RegistrationValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def _category(company_id):
    cat = MagicMock()
    cat.company_id = company_id
    cat.status = "active"
    return cat


def test_rejects_client_supplied_asset_code() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    with pytest.raises(RegistrationValidationError, match="asset_code"):
        validator.validate_create_fields(
            ctx,
            company_id=ctx.company_id,
            branch_id=ctx.branch_id,
            fields={"asset_code": "AST-2026-000001"},
        )


def test_submit_readiness_missing_mandatory() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    row = MagicMock()
    row.status = "draft"
    row.asset_name = ""
    row.asset_category_id = uuid4()
    row.asset_type = "fixed"
    row.purchase_date = date.today()
    row.purchase_cost = Decimal("1")
    row.currency_code = "USD"
    with pytest.raises(RegistrationValidationError, match="asset_name"):
        validator.validate_submit_readiness(ctx, row)


def test_duplicate_serial_raises() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    company_id = ctx.company_id
    category = _category(company_id)
    with patch.object(validator._categories, "get", return_value=category):
        with patch.object(validator._assets, "find_by_serial", return_value=MagicMock()):
            with pytest.raises(DuplicateAssetRegistrationError, match="Serial"):
                validator._validate_common(
                    ctx,
                    company_id=company_id,
                    fields={
                        "asset_name": "Laptop",
                        "asset_category_id": uuid4(),
                        "asset_type": "fixed",
                        "purchase_date": date.today(),
                        "purchase_cost": Decimal("100"),
                        "currency_code": "USD",
                        "serial_number": "SN-1",
                    },
                    exclude_id=None,
                    partial=False,
                )


def test_duplicate_barcode_raises() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    company_id = ctx.company_id
    category = _category(company_id)
    with patch.object(validator._categories, "get", return_value=category):
        with patch.object(validator._assets, "find_by_serial", return_value=None):
            with patch.object(validator._assets, "find_by_barcode", return_value=MagicMock()):
                with pytest.raises(DuplicateAssetRegistrationError, match="Barcode"):
                    validator._validate_common(
                        ctx,
                        company_id=company_id,
                        fields={
                            "asset_name": "Laptop",
                            "asset_category_id": uuid4(),
                            "asset_type": "fixed",
                            "purchase_date": date.today(),
                            "purchase_cost": Decimal("100"),
                            "currency_code": "USD",
                            "barcode": "BC-1",
                        },
                        exclude_id=None,
                        partial=False,
                    )


def test_future_purchase_date_rejected() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    with pytest.raises(RegistrationValidationError, match="future"):
        validator._validate_common(
            ctx,
            company_id=ctx.company_id,
            fields={"purchase_date": date.today() + timedelta(days=1)},
            exclude_id=None,
            partial=True,
        )


def test_po_validation_delegates_to_port() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    po_id = uuid4()
    with patch.object(
        validator._procurement, "validate_purchase_order", side_effect=None
    ) as mock_po:
        validator._validate_common(
            ctx,
            company_id=ctx.company_id,
            fields={"purchase_order_id": po_id},
            exclude_id=None,
            partial=True,
        )
        mock_po.assert_called_once_with(ctx, ctx.company_id, po_id)


def test_grn_po_mismatch_rejected() -> None:
    db = MagicMock()
    validator = RegistrationValidator(db)
    ctx = _ctx()
    po_id = uuid4()
    grn_id = uuid4()
    grn = MagicMock()
    grn.order_header_id = uuid4()
    with patch.object(validator._procurement, "validate_grn"):
        with patch.object(validator._procurement, "validate_purchase_order"):
            with patch.object(validator._procurement, "get_grn", return_value=grn):
                with pytest.raises(RegistrationValidationError, match="not linked"):
                    validator._validate_common(
                        ctx,
                        company_id=ctx.company_id,
                        fields={"purchase_order_id": po_id, "grn_id": grn_id},
                        exclude_id=None,
                        partial=True,
                    )
