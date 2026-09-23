"""Unit tests — create_for_import + registration validator (CR-004 Phase 8B)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import (
    DuplicateAssetRegistrationError,
    RegistrationValidationError,
)
from modules.asset.service.asset_service import AssetService
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


def test_validate_create_rejects_client_asset_code() -> None:
    v = RegistrationValidator(MagicMock())
    with (
        patch.object(v, "_validate_common"),
        pytest.raises(RegistrationValidationError, match="system-assigned"),
    ):
        v.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            branch_id=uuid4(),
            fields={"asset_code": "X", "asset_name": "n"},
        )


def test_validate_create_for_import_allows_blank_asset_code() -> None:
    v = RegistrationValidator(MagicMock())
    with (
        patch.object(v, "_validate_common") as common,
    ):
        v.validate_create_for_import_fields(
            _ctx(),
            company_id=uuid4(),
            branch_id=uuid4(),
            fields={"asset_name": "n", "asset_code": ""},
        )
    common.assert_called_once()


def test_validate_create_for_import_duplicate_tag() -> None:
    v = RegistrationValidator(MagicMock())
    with (
        patch.object(v._assets, "find_by_code", return_value=SimpleNamespace(id=uuid4())),
        pytest.raises(DuplicateAssetRegistrationError, match="already registered"),
    ):
        v.validate_create_for_import_fields(
            _ctx(),
            company_id=uuid4(),
            branch_id=uuid4(),
            fields={"asset_code": "AST-1", "asset_name": "n"},
        )


def test_validate_create_for_import_delegates_common() -> None:
    v = RegistrationValidator(MagicMock())
    with (
        patch.object(v._assets, "find_by_code", return_value=None),
        patch.object(v, "_validate_common") as common,
    ):
        v.validate_create_for_import_fields(
            _ctx(),
            company_id=uuid4(),
            branch_id=uuid4(),
            fields={"asset_code": "AST-1", "asset_name": "n"},
        )
    common.assert_called_once()


def test_create_for_import_auto_generates_code_when_blank() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    branch_id = uuid4()
    asset_id = uuid4()
    created = SimpleNamespace(id=asset_id, asset_code="AST-2026-000001")
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_for_import_fields"),
        patch.object(svc._numbers, "generate", return_value="AST-2026-000001"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change"),
    ):
        svc.create_for_import(
            ctx,
            branch_id=branch_id,
            asset_code=None,
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("0"),
            currency_code="USD",
        )
    assert create.call_args.kwargs["asset_code"] == "AST-2026-000001"
    assert create.call_args.kwargs["document_number"] == "AST-2026-000001"


def test_create_for_import_persists_external_code() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    branch_id = uuid4()
    asset_id = uuid4()
    created = SimpleNamespace(id=asset_id, asset_code="TAG-1")
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_for_import_fields"),
        patch.object(svc._numbers, "generate", return_value="DOC-1"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change") as audit,
    ):
        row = svc.create_for_import(
            ctx,
            branch_id=branch_id,
            asset_code=" TAG-1 ",
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("0"),
            currency_code="USD",
        )
    assert row is created
    assert create.call_args.kwargs["asset_code"] == "TAG-1"
    assert create.call_args.kwargs["document_number"] == "DOC-1"
    assert create.call_args.kwargs["status"] == "draft"
    audit.assert_called_once()
    assert audit.call_args.kwargs["new_value"]["source"] == "excel_import"


def test_create_strips_asset_code_still() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    created = SimpleNamespace(id=uuid4())
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._scope, "validate_branch_access"),
        patch.object(svc._validator, "validate_create_fields"),
        patch.object(svc._numbers, "generate", return_value="DOC-9"),
        patch.object(svc._repo, "create", return_value=created) as create,
        patch.object(svc._audit, "log_entity_change"),
    ):
        svc.create(
            ctx,
            branch_id=uuid4(),
            asset_code="SHOULD_STRIP",
            asset_name="Laptop",
            asset_category_id=uuid4(),
            asset_type="fixed",
            purchase_date=date.today(),
            purchase_cost=Decimal("10"),
            currency_code="USD",
        )
    assert create.call_args.kwargs["asset_code"] == "DOC-9"


def test_find_by_asset_code_delegates() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "find_by_code", return_value=None) as find,
    ):
        assert svc.find_by_asset_code(ctx, "A") is None
    find.assert_called_once()


def test_find_by_serial_number_delegates() -> None:
    svc = AssetService(MagicMock())
    ctx = _ctx()
    with (
        patch.object(svc._scope, "resolve_company_id", return_value=ctx.company_id),
        patch.object(svc._repo, "find_by_serial", return_value=None) as find,
    ):
        assert svc.find_by_serial_number(ctx, "S") is None
    find.assert_called_once()
