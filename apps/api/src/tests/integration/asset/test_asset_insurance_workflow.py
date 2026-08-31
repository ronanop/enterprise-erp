"""Asset insurance workflow integration tests (FP-ASSET-010)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.exceptions import InsuranceValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_insurance import AstAssetInsurance
from modules.asset.service.insurance_service import InsuranceService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def insurance_db():
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
        schema_translate_map={"asset": None, "foundation": None, "master": None}
    )
    for table in [AstAssetCategory.__table__, AstAsset.__table__, AstAssetInsurance.__table__]:
        table.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
        session.rollback()
    finally:
        session.close()
        raw.dispose()


@pytest.fixture
def ids() -> dict[str, object]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "branch_id": uuid4(),
        "user_id": uuid4(),
        "category_id": uuid4(),
    }


def _ctx(ids: dict[str, object]) -> TenantContext:
    return TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="employee",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _insert_active_asset(db: Session, ids: dict[str, object], **kwargs) -> AstAsset:
    now = datetime.now(timezone.utc)
    category = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        category_code="IT",
        category_name="IT Equipment",
        status="active",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
    )
    db.merge(category)
    code = f"AST-{uuid4().hex[:8]}"
    defaults = {
        "purchase_cost": Decimal("12000.0000"),
        "salvage_value": Decimal("0"),
        "current_book_value": Decimal("12000.0000"),
        "useful_life_months": 12,
        "depreciation_method": "straight_line",
        "purchase_date": date(2026, 1, 1),
        "status": "active",
    }
    defaults.update(kwargs)
    row = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Insurance Asset",
        asset_category_id=ids["category_id"],
        asset_type="fixed",
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


@contextmanager
def _patched_side_channels(svc: InsuranceService):
    with (
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(
            svc._validator._master,
            "get_vendor",
            return_value=SimpleNamespace(id=uuid4()),
        ),
    ):
        yield


def test_draft_activate_renew_expire_close_lifecycle(insurance_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(insurance_db, ids)
    svc = InsuranceService(insurance_db)
    with _patched_side_channels(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            policy_number="POL-001",
            insurer_name="Acme Insurance",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
            coverage_amount=Decimal("50000"),
        )
        assert row.status == "draft"

        active = svc.activate(ctx, row.id)
        assert active.status == "active"

        renewed = svc.renew(ctx, row.id, new_end_date=date(2028, 1, 1))
        assert renewed.status == "renewed"
        assert renewed.end_date == date(2028, 1, 1)

        expired = svc.expire(ctx, row.id)
        assert expired.status == "expired"

        closed = svc.close(ctx, row.id)
        assert closed.status == "cancelled"


def test_disposed_asset_blocked(insurance_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(insurance_db, ids, status="disposed")
    svc = InsuranceService(insurance_db)
    with _patched_side_channels(svc):
        with pytest.raises(InsuranceValidationError, match="Disposed"):
            svc.create(
                ctx,
                asset_id=asset.id,
                policy_number="POL-002",
                insurer_name="Acme",
                start_date=date(2026, 1, 1),
                end_date=date(2027, 1, 1),
            )


def test_duplicate_open_policy_blocked(insurance_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(insurance_db, ids)
    svc = InsuranceService(insurance_db)
    with _patched_side_channels(svc):
        first = svc.create(
            ctx,
            asset_id=asset.id,
            policy_number="POL-A",
            insurer_name="Acme",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
        )
        svc.activate(ctx, first.id)
        second = svc.create(
            ctx,
            asset_id=asset.id,
            policy_number="POL-B",
            insurer_name="Beta",
            start_date=date(2026, 2, 1),
            end_date=date(2027, 2, 1),
        )
        with pytest.raises(InsuranceValidationError, match="already has an active"):
            svc.activate(ctx, second.id)


def test_active_patch_rejects_end_date_increase(insurance_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(insurance_db, ids)
    svc = InsuranceService(insurance_db)
    with _patched_side_channels(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            policy_number="POL-C",
            insurer_name="Acme",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
        )
        active = svc.activate(ctx, row.id)
        original_end = active.end_date
        original_version = active.version

        with pytest.raises(InsuranceValidationError, match="POST /renew"):
            svc.update(
                ctx,
                row.id,
                end_date=date(2028, 6, 1),
                version=int(active.version or 1),
            )

        reloaded = svc.get(ctx, row.id)
        assert reloaded.status == "active"
        assert reloaded.end_date == original_end
        assert reloaded.version == original_version


def test_renewed_to_expired(insurance_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(insurance_db, ids)
    svc = InsuranceService(insurance_db)
    with _patched_side_channels(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            policy_number="POL-D",
            insurer_name="Acme",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
        )
        svc.activate(ctx, row.id)
        renewed = svc.renew(ctx, row.id, new_end_date=date(2028, 1, 1))
        assert renewed.status == "renewed"

        expired = svc.expire(ctx, row.id)
        assert expired.status == "expired"


def test_search_filters(insurance_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(insurance_db, ids)
    svc = InsuranceService(insurance_db)
    with _patched_side_channels(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            policy_number="POL-SEARCH",
            insurer_name="Search Insurer",
            start_date=date(2026, 1, 1),
            end_date=date(2027, 1, 1),
        )
        items, total = svc.search(
            ctx,
            search="POL-SEARCH",
            offset=0,
            limit=25,
        )
        assert total >= 1
        assert any(r.policy_number == "POL-SEARCH" for r in items)
