"""Unit tests for RevaluationValidator (FP-ASSET-007)."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from modules.asset.domain.exceptions import RevaluationValidationError
from modules.asset.service.revaluation_validator import RevaluationValidator
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(), user_id=uuid4(), user_type="employee",
        company_id=uuid4(), branch_id=uuid4(),
    )


def test_create_requires_asset_id_new_book_value_and_reason() -> None:
    validator = RevaluationValidator(MagicMock())
    ctx = _ctx()
    with pytest.raises(RevaluationValidationError, match="asset_id"):
        validator.validate_create_fields(ctx, company_id=ctx.company_id, fields={})

    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(RevaluationValidationError, match="new_book_value"):
            validator.validate_create_fields(
                ctx, company_id=ctx.company_id, fields={"asset_id": asset.id, "reason": "market"}
            )
        with pytest.raises(RevaluationValidationError, match="reason"):
            validator.validate_create_fields(
                ctx, company_id=ctx.company_id, fields={"asset_id": asset.id, "new_book_value": 150}
            )


def test_create_blocks_disposed_assets() -> None:
    validator = RevaluationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="disposed")
    with patch.object(validator._assets, "get", return_value=asset):
        with pytest.raises(RevaluationValidationError, match="Disposed"):
            validator.validate_create_fields(
                ctx, company_id=ctx.company_id,
                fields={"asset_id": asset.id, "new_book_value": 150, "reason": "market"},
            )


def test_create_blocks_open_disposal() -> None:
    validator = RevaluationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    disposal = SimpleNamespace(document_number="ADISP-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=disposal):
            with pytest.raises(RevaluationValidationError, match="open disposal"):
                validator.validate_create_fields(
                    ctx, company_id=ctx.company_id,
                    fields={"asset_id": asset.id, "new_book_value": 150, "reason": "market"},
                )


def test_create_blocks_open_revaluation_exclusivity() -> None:
    validator = RevaluationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    revaluation = SimpleNamespace(document_number="AREV-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._revals, "find_pending_for_asset", return_value=revaluation):
                with pytest.raises(RevaluationValidationError, match="open revaluation"):
                    validator.validate_create_fields(
                        ctx, company_id=ctx.company_id,
                        fields={"asset_id": asset.id, "new_book_value": 150, "reason": "market"},
                    )


def test_post_rejects_already_posted() -> None:
    validator = RevaluationValidator(MagicMock())
    row = SimpleNamespace(
        status="posted", finance_journal_id=uuid4(), revaluation_date=None, asset_id=uuid4()
    )
    with pytest.raises(RevaluationValidationError, match="already posted"):
        validator.validate_post_readiness(_ctx(), row)


def test_submit_rejects_missing_revaluation_date() -> None:
    validator = RevaluationValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    row = SimpleNamespace(
        id=uuid4(),
        status="draft",
        asset_id=asset.id,
        revaluation_date=None,
        new_book_value=150,
        old_book_value=100,
        reason="market",
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None):
            with patch.object(validator._revals, "find_pending_for_asset", return_value=None):
                with pytest.raises(RevaluationValidationError, match="revaluation_date"):
                    validator.validate_submit_readiness(ctx, row)
