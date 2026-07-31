"""Unit tests for DocumentValidator (FP-ASSET-016)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import DocumentValidationError
from modules.asset.service.document_validator import DocumentValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx(user_type: str = "employee") -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type=user_type,
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_create_requires_asset_id() -> None:
    validator = DocumentValidator(MagicMock())
    with pytest.raises(DocumentValidationError, match="asset_id"):
        validator.validate_create_fields(_ctx(), company_id=uuid4(), fields={})


def test_create_rejects_invalid_document_type() -> None:
    validator = DocumentValidator(MagicMock())
    with pytest.raises(DocumentValidationError, match="document_type"):
        validator.validate_create_fields(
            _ctx(),
            company_id=uuid4(),
            fields={"asset_id": uuid4(), "document_type": "pdf", "document_name": "X"},
        )


def test_create_rejects_status_override() -> None:
    validator = DocumentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DocumentValidationError, match="active status"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "document_type": "invoice",
                    "document_name": "INV-1",
                    "status": "archived",
                },
            )


@pytest.mark.parametrize("user_type", ["employee", "tenant_admin", "super_admin"])
def test_create_rejects_asset_company_mismatch(user_type: str) -> None:
    validator = DocumentValidator(MagicMock())
    ctx = _ctx(user_type=user_type)
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=uuid4(), status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DocumentValidationError, match="does not belong to this company"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "document_type": "invoice",
                    "document_name": "INV-1",
                },
            )


def test_create_rejects_disposed_asset() -> None:
    validator = DocumentValidator(MagicMock())
    ctx = _ctx()
    asset_id = uuid4()
    asset = SimpleNamespace(id=asset_id, company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(DocumentValidationError, match="disposed or written-off"):
            validator.validate_create_fields(
                ctx,
                company_id=ctx.company_id,
                fields={
                    "asset_id": asset_id,
                    "document_type": "invoice",
                    "document_name": "INV-1",
                },
            )


def test_storage_uri_allows_https() -> None:
    assert (
        DocumentValidator.validate_storage_uri("https://cdn.example.com/docs/a.pdf")
        == "https://cdn.example.com/docs/a.pdf"
    )


def test_storage_uri_allows_s3() -> None:
    assert DocumentValidator.validate_storage_uri("s3://bucket/key") == "s3://bucket/key"


def test_storage_uri_allows_relative_key() -> None:
    assert DocumentValidator.validate_storage_uri("tenant/a/doc.pdf") == "tenant/a/doc.pdf"


def test_storage_uri_rejects_http() -> None:
    with pytest.raises(DocumentValidationError, match="scheme"):
        DocumentValidator.validate_storage_uri("http://insecure.example.com/x")


def test_storage_uri_rejects_javascript() -> None:
    with pytest.raises(DocumentValidationError, match="not allowed"):
        DocumentValidator.validate_storage_uri("javascript:alert(1)")


def test_storage_uri_rejects_empty() -> None:
    with pytest.raises(DocumentValidationError, match="empty"):
        DocumentValidator.validate_storage_uri("   ")


def test_update_rejects_terminal_status() -> None:
    validator = DocumentValidator(MagicMock())
    row = SimpleNamespace(
        status="archived",
        asset_id=uuid4(),
        company_id=uuid4(),
        document_type="invoice",
    )
    with pytest.raises(DocumentValidationError, match="Only active"):
        validator.validate_update_fields(_ctx(), row, {"document_name": "X"})


def test_supersede_requires_active() -> None:
    validator = DocumentValidator(MagicMock())
    row = SimpleNamespace(status="superseded")
    with pytest.raises(DocumentValidationError, match="Only active"):
        validator.validate_supersede_readiness(_ctx(), row)


def test_archive_allows_superseded() -> None:
    validator = DocumentValidator(MagicMock())
    row = SimpleNamespace(status="superseded")
    validator.validate_archive_readiness(_ctx(), row)
