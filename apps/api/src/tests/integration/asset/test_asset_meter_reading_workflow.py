"""Asset meter reading workflow integration tests (FP-ASSET-015)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.exceptions import MeterReadingValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_meter_reading import AstAssetMeterReading
from modules.asset.service.meter_reading_service import MeterReadingService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def meter_db():
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
    for table in [
        AstAssetCategory.__table__,
        AstAsset.__table__,
        AstAssetMeterReading.__table__,
    ]:
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


def _insert_asset(meter_db: Session, ids: dict[str, object], *, company_id=None) -> AstAsset:
    now = datetime.now(timezone.utc)
    resolved_company = company_id or ids["company_id"]
    category = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=ids["tenant_id"],
        company_id=resolved_company,
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
    meter_db.merge(category)
    code = f"AST-{uuid4().hex[:8]}"
    asset = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=resolved_company,
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Meter Asset",
        asset_category_id=ids["category_id"],
        asset_type="fixed",
        currency_code="USD",
        purchase_cost=Decimal("10000"),
        salvage_value=Decimal("0"),
        current_book_value=Decimal("10000"),
        useful_life_months=12,
        depreciation_method="straight_line",
        purchase_date=date(2026, 1, 1),
        is_shared=False,
        status="active",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
    )
    meter_db.add(asset)
    meter_db.flush()
    return asset


@contextmanager
def _patched_audit(svc: MeterReadingService):
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        yield


def test_create_and_void_reading(meter_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(meter_db, ids)
    svc = MeterReadingService(meter_db)
    when = datetime.now(timezone.utc)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            meter_type="odometer",
            reading_value=Decimal("1000"),
            reading_at=when,
        )
    assert row.status == "recorded"
    with _patched_audit(svc):
        voided = svc.void(ctx, row.id)
    assert voided.status == "void"


def test_create_rejects_decreasing_value(meter_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(meter_db, ids)
    svc = MeterReadingService(meter_db)
    when = datetime.now(timezone.utc) - timedelta(hours=1)
    with _patched_audit(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            meter_type="odometer",
            reading_value=Decimal("500"),
            reading_at=when,
        )
        with pytest.raises(MeterReadingValidationError, match="less than the latest"):
            svc.create(
                ctx,
                asset_id=asset.id,
                meter_type="odometer",
                reading_value=Decimal("100"),
                reading_at=when + timedelta(minutes=1),
            )


def test_search_filters_by_asset(meter_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(meter_db, ids)
    svc = MeterReadingService(meter_db)
    when = datetime.now(timezone.utc)
    with _patched_audit(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            meter_type="runtime_hours",
            reading_value=Decimal("50"),
            reading_at=when,
        )
    items, total = svc.search(ctx, asset_id=asset.id, meter_type="runtime_hours", offset=0, limit=25)
    assert total >= 1


def test_create_rejects_asset_company_mismatch_for_admin(meter_db: Session, ids: dict[str, object]):
    ctx = TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="tenant_admin",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )
    asset = _insert_asset(meter_db, ids, company_id=uuid4())
    svc = MeterReadingService(meter_db)
    with _patched_audit(svc):
        with pytest.raises(MeterReadingValidationError, match="does not belong to this company"):
            svc.create(
                ctx,
                asset_id=asset.id,
                meter_type="odometer",
                reading_value=Decimal("100"),
                reading_at=datetime.now(timezone.utc),
            )
