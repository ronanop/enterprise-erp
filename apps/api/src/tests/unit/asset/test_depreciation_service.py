"""Unit tests for DepreciationService (FP-ASSET-006)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from core.exceptions import ConflictException
from modules.asset.service.depreciation_service import DepreciationService
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_post_claim_conflict_skips_finance() -> None:
    svc = DepreciationService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        status="calculated",
        finance_journal_id=None,
        depreciation_amount=Decimal("100"),
        book_value_after=Decimal("900"),
        asset_id=uuid4(),
        version=1,
        method="straight_line",
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._finance, "post_depreciation") as post_fn:
                    with pytest.raises(ConflictException):
                        svc.post(ctx, row.id, debit_account_id=uuid4(), credit_account_id=uuid4())
                    post_fn.assert_not_called()


def test_post_updates_book_value() -> None:
    svc = DepreciationService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    journal_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="calculated",
        finance_journal_id=None,
        depreciation_amount=Decimal("100"),
        book_value_after=Decimal("900"),
        asset_id=asset_id,
        version=1,
        method="straight_line",
    )
    claimed = SimpleNamespace(**{**row.__dict__, "version": 2})
    posted = SimpleNamespace(
        **{**claimed.__dict__, "status": "posted", "finance_journal_id": journal_id, "version": 3}
    )
    asset = SimpleNamespace(id=asset_id, current_book_value=Decimal("1000"))

    def _update(_ctx, _id, **fields):
        if "finance_journal_id" in fields:
            return posted
        return claimed

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_post_readiness", return_value=None):
            with patch.object(svc._finance, "post_depreciation", return_value=journal_id):
                with patch.object(svc._engine, "post"):
                    with patch.object(svc._repo, "update", side_effect=_update):
                        with patch.object(svc._assets, "get", return_value=asset):
                            with patch.object(svc._assets, "update") as asset_update:
                                with patch.object(svc._audit, "log_entity_change"):
                                    result = svc.post(
                                        ctx,
                                        row_id,
                                        debit_account_id=uuid4(),
                                        credit_account_id=uuid4(),
                                    )
    asset_update.assert_called_once_with(
        ctx, asset_id, current_book_value=Decimal("900")
    )
    assert result is posted


def test_reverse_claim_conflict_skips_finance() -> None:
    svc = DepreciationService(MagicMock())
    ctx = _ctx()
    row = SimpleNamespace(
        id=uuid4(),
        status="posted",
        depreciation_amount=Decimal("100"),
        asset_id=uuid4(),
        version=2,
        method="straight_line",
    )
    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_reverse_readiness", return_value=None):
            with patch.object(
                svc._repo,
                "update",
                side_effect=ConflictException("modified by another user"),
            ):
                with patch.object(svc._finance, "post_depreciation") as post_fn:
                    with pytest.raises(ConflictException):
                        svc.reverse(
                            ctx, row.id, debit_account_id=uuid4(), credit_account_id=uuid4()
                        )
                    post_fn.assert_not_called()


def test_reverse_swaps_accounts_for_finance_journal() -> None:
    svc = DepreciationService(MagicMock())
    ctx = _ctx()
    row_id = uuid4()
    asset_id = uuid4()
    expense_acct = uuid4()
    accum_acct = uuid4()
    journal_id = uuid4()
    row = SimpleNamespace(
        id=row_id,
        status="posted",
        depreciation_amount=Decimal("100"),
        asset_id=asset_id,
        version=2,
        method="straight_line",
    )
    claimed = SimpleNamespace(**{**row.__dict__, "version": 3})
    reversed_row = SimpleNamespace(**{**claimed.__dict__, "status": "reversed", "version": 4})
    asset = SimpleNamespace(id=asset_id, current_book_value=Decimal("900"))

    def _update(_ctx, _id, **fields):
        if "status" in fields:
            return reversed_row
        return claimed

    with patch.object(svc, "get", return_value=row):
        with patch.object(svc._validator, "validate_reverse_readiness", return_value=None):
            with patch.object(svc._finance, "post_depreciation", return_value=journal_id) as post_fn:
                with patch.object(svc._engine, "reverse") as eng_rev:
                    with patch.object(svc._repo, "update", side_effect=_update):
                        with patch.object(svc._assets, "get", return_value=asset):
                            with patch.object(svc._assets, "update") as asset_update:
                                with patch.object(svc._audit, "log_entity_change"):
                                    svc.reverse(
                                        ctx,
                                        row_id,
                                        debit_account_id=expense_acct,
                                        credit_account_id=accum_acct,
                                    )
    # Original post: Dr expense / Cr accum → reverse swaps to Dr accum / Cr expense
    post_fn.assert_called_once()
    kwargs = post_fn.call_args.kwargs
    assert kwargs["debit_account_id"] == accum_acct
    assert kwargs["credit_account_id"] == expense_acct
    eng_rev.assert_called_once()
    asset_update.assert_called_once_with(
        ctx, asset_id, current_book_value=Decimal("1000")
    )
