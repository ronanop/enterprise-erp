"""Integration-style depreciation workflow tests (SQLite)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.exceptions import DepreciationValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_depreciation import AstAssetDepreciation
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.service.depreciation_service import DepreciationService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance


@pytest.fixture
def dep_db():
    raw = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(raw, "connect")
    def _fk_off(dbapi_conn, _record) -> None:  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    engine = raw.execution_options(
        schema_translate_map={"asset": None, "foundation": None, "organization": None, "master": None}
    )
    for table in [
        WfInstance.__table__,
        AstAssetCategory.__table__,
        AstAsset.__table__,
        AstAssetDepreciation.__table__,
        AstAssetDisposal.__table__,
    ]:
        table.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.rollback()
    finally:
        session.close()
        raw.dispose()


@pytest.fixture
def ids():
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "branch_id": uuid4(),
        "user_id": uuid4(),
        "category_id": uuid4(),
    }


def _ctx(ids) -> TenantContext:
    return TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="employee",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _insert_active_asset(db: Session, ids, **kwargs) -> AstAsset:
    now = datetime.now(timezone.utc)
    cat = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        category_code="IT",
        category_name="IT",
        status="active",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
    )
    db.merge(cat)
    code = f"AST-{uuid4().hex[:8]}"
    defaults = dict(
        purchase_cost=Decimal("12000.0000"),
        salvage_value=Decimal("0"),
        current_book_value=Decimal("12000.0000"),
        useful_life_months=12,
        depreciation_method="straight_line",
        purchase_date=date(2026, 1, 1),
    )
    defaults.update(kwargs)
    row = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Dep Asset",
        asset_category_id=ids["category_id"],
        asset_type="fixed",
        status="active",
        currency_code="USD",
        is_shared=False,
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
        **defaults,
    )
    db.add(row)
    db.flush()
    return row


@pytest.mark.integration
def test_int_dep_create_calculate_post_updates_book(dep_db, ids) -> None:
    asset = _insert_active_asset(dep_db, ids)
    svc = DepreciationService(dep_db)
    ctx = _ctx(ids)
    journal_id = uuid4()

    with (
        patch.object(svc._numbers, "generate", return_value=f"ADEP-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(svc._finance, "post_depreciation", return_value=journal_id),
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
    ):
        draft = svc.create(
            ctx,
            company_id=ids["company_id"],
            asset_id=asset.id,
            period_year=2026,
            period_month=7,
            method="straight_line",
        )
        calculated = svc.calculate(ctx, draft.id)
        assert calculated.status == "calculated"
        assert Decimal(str(calculated.depreciation_amount)) == Decimal("1000.0000")
        posted = svc.post(ctx, draft.id, debit_account_id=uuid4(), credit_account_id=uuid4())
        assert posted.status == "posted"
        dep_db.refresh(asset)
        assert Decimal(str(asset.current_book_value)) == Decimal("11000.0000")


@pytest.mark.integration
def test_int_dep_duplicate_period_blocked(dep_db, ids) -> None:
    asset = _insert_active_asset(dep_db, ids)
    svc = DepreciationService(dep_db)
    ctx = _ctx(ids)
    with (
        patch.object(svc._numbers, "generate", return_value=f"ADEP-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
    ):
        svc.create(
            ctx,
            company_id=ids["company_id"],
            asset_id=asset.id,
            period_year=2026,
            period_month=7,
            method="straight_line",
        )
        with pytest.raises(DepreciationValidationError, match="already has depreciation"):
            svc.create(
                ctx,
                company_id=ids["company_id"],
                asset_id=asset.id,
                period_year=2026,
                period_month=7,
                method="straight_line",
            )


@pytest.mark.integration
def test_int_dep_generate_batch(dep_db, ids) -> None:
    _insert_active_asset(dep_db, ids)
    svc = DepreciationService(dep_db)
    ctx = _ctx(ids)
    with (
        patch.object(svc._numbers, "generate", side_effect=lambda *a, **k: f"ADEP-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
    ):
        result = svc.generate_period_run(ctx, period_year=2026, period_month=7, company_id=ids["company_id"])
    assert result["created_count"] >= 1
    assert result["depreciation_batch_id"] is not None
    batch_rows = list(
        dep_db.scalars(
            select(AstAssetDepreciation).where(
                AstAssetDepreciation.depreciation_batch_id == result["depreciation_batch_id"]
            )
        ).all()
    )
    assert all(r.status == "draft" for r in batch_rows)


@pytest.mark.integration
def test_int_dep_failed_finance_sets_failed(dep_db, ids) -> None:
    asset = _insert_active_asset(dep_db, ids)
    svc = DepreciationService(dep_db)
    ctx = _ctx(ids)
    with (
        patch.object(svc._numbers, "generate", return_value=f"ADEP-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(svc._finance, "post_depreciation", side_effect=RuntimeError("finance down")),
    ):
        draft = svc.create(
            ctx,
            company_id=ids["company_id"],
            asset_id=asset.id,
            period_year=2026,
            period_month=8,
            method="straight_line",
        )
        svc.calculate(ctx, draft.id)
        with pytest.raises(RuntimeError, match="finance down"):
            svc.post(ctx, draft.id, debit_account_id=uuid4(), credit_account_id=uuid4())
        row = svc.get(ctx, draft.id)
        assert row.status == "failed"


@pytest.mark.integration
def test_int_dep_reverse_restores_book(dep_db, ids) -> None:
    asset = _insert_active_asset(dep_db, ids)
    svc = DepreciationService(dep_db)
    ctx = _ctx(ids)
    expense_acct = uuid4()
    accum_acct = uuid4()
    with (
        patch.object(svc._numbers, "generate", return_value=f"ADEP-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None),
        patch.object(svc._finance, "post_depreciation", return_value=uuid4()) as post_fn,
    ):
        draft = svc.create(
            ctx,
            company_id=ids["company_id"],
            asset_id=asset.id,
            period_year=2026,
            period_month=9,
            method="straight_line",
        )
        svc.calculate(ctx, draft.id)
        svc.post(ctx, draft.id, debit_account_id=expense_acct, credit_account_id=accum_acct)
        dep_db.refresh(asset)
        assert Decimal(str(asset.current_book_value)) == Decimal("11000.0000")
        post_fn.reset_mock()
        post_fn.return_value = uuid4()
        svc.reverse(ctx, draft.id, debit_account_id=expense_acct, credit_account_id=accum_acct)
        dep_db.refresh(asset)
        assert Decimal(str(asset.current_book_value)) == Decimal("12000.0000")
        assert svc.get(ctx, draft.id).status == "reversed"
        assert post_fn.call_count == 1
        rev_kwargs = post_fn.call_args.kwargs
        assert rev_kwargs["debit_account_id"] == accum_acct
        assert rev_kwargs["credit_account_id"] == expense_acct
        with pytest.raises(DepreciationValidationError, match="already reversed"):
            svc.reverse(ctx, draft.id, debit_account_id=expense_acct, credit_account_id=accum_acct)


@pytest.mark.integration
def test_int_dep_open_disposal_blocks_create_and_calculate(dep_db, ids) -> None:
    """Open disposal gate blocks depreciation create/calculate (no mock of disposal lookup)."""
    asset = _insert_active_asset(dep_db, ids)
    now = datetime.now(timezone.utc)
    disposal = AstAssetDisposal(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"ADISP-{uuid4().hex[:8]}",
        asset_id=asset.id,
        disposal_type="scrap",
        disposal_date=date.today(),
        book_value_at_disposal=Decimal("12000.0000"),
        status="draft",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
    )
    dep_db.add(disposal)
    dep_db.flush()

    svc = DepreciationService(dep_db)
    ctx = _ctx(ids)
    with (
        patch.object(svc._numbers, "generate", return_value=f"ADEP-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        with pytest.raises(DepreciationValidationError, match="open disposal"):
            svc.create(
                ctx,
                company_id=ids["company_id"],
                asset_id=asset.id,
                period_year=2026,
                period_month=10,
                method="straight_line",
            )

        # Seed a draft depreciation without disposal gate, then re-open gate for calculate
        with patch.object(svc._validator._disposals, "find_pending_for_asset", return_value=None):
            draft = svc.create(
                ctx,
                company_id=ids["company_id"],
                asset_id=asset.id,
                period_year=2026,
                period_month=10,
                method="straight_line",
            )
        with pytest.raises(DepreciationValidationError, match="open disposal"):
            svc.calculate(ctx, draft.id)
