"""Unit tests for RevaluationService (FP-ASSET-007)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.revaluation_service import RevaluationService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(), user_id=uuid4(), user_type="employee",
        company_id=uuid4(), branch_id=uuid4(),
    )


def test_post_claim_conflict_skips_finance() -> None:
    svc = RevaluationService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(), status="approved", finance_journal_id=None, asset_id=uuid4(),
        old_book_value=Decimal("100"), new_book_value=Decimal("150"), version=1,
        revaluation_date=None,
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(
                svc._repo, "update", side_effect=ConflictException("modified by another user")
            ):
                with patch.object(svc._finance, "post_revaluation") as post_fn:
                    with pytest.raises(ConflictException):
                        svc.post(ctx, row.id, debit_account_id=uuid4(), credit_account_id=uuid4())
                    post_fn.assert_not_called()


def test_post_updates_book_value() -> None:
    svc = RevaluationService(MagicMock())
    ctx = _ctx()
    row_id, asset_id, journal_id = uuid4(), uuid4(), uuid4()
    row = SimpleNamespace(
        id=row_id, status="approved", finance_journal_id=None, asset_id=asset_id,
        old_book_value=Decimal("100"), new_book_value=Decimal("150"), version=1,
        revaluation_date=None,
    )
    claimed = SimpleNamespace(**{**row.__dict__, "version": 2})
    posted = SimpleNamespace(
        **{**claimed.__dict__, "status": "posted", "finance_journal_id": journal_id, "version": 3}
    )
    asset = SimpleNamespace(id=asset_id, current_book_value=Decimal("100"))

    def _update(_ctx, _id, **fields):
        return posted if "finance_journal_id" in fields else claimed

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(svc._finance, "post_revaluation", return_value=journal_id):
                with patch.object(svc._engine, "post") as engine_post:
                    with patch.object(svc._repo, "update", side_effect=_update):
                        with patch.object(svc._assets, "get", return_value=asset):
                            with patch.object(svc._assets, "update") as asset_update:
                                with patch.object(svc._audit, "log_entity_change"):
                                    result = svc.post(
                                        ctx, row_id, debit_account_id=uuid4(), credit_account_id=uuid4()
                                    )

    engine_post.assert_called_once_with(claimed)
    asset_update.assert_called_once_with(ctx, asset_id, current_book_value=Decimal("150"))
    assert result is posted
