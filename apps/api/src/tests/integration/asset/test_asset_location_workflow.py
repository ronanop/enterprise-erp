"""Asset location workflow integration tests (FP-ASSET-012)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.exceptions import LocationValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_location import AstAssetLocation
from modules.asset.service.location_service import LocationService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def location_db():
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
        AstAssetLocation.__table__,
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
        asset_name="Location Asset",
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
def _patched_audit(svc: LocationService):
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        yield


def test_create_supersedes_prior_current(location_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(location_db, ids)
    svc = LocationService(location_db)
    with _patched_audit(svc):
        first = svc.create(
            ctx,
            asset_id=asset.id,
            location_label="Building A",
        )
        assert first.status == "active"
        assert first.is_current is True

        second = svc.create(
            ctx,
            asset_id=asset.id,
            location_label="Building B",
        )
        assert second.status == "active"
        assert second.is_current is True

        refreshed_first = svc.get(ctx, first.id)
        assert refreshed_first.status == "historical"
        assert refreshed_first.is_current is False
        assert refreshed_first.effective_to is not None


def test_complete_marks_historical(location_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(location_db, ids)
    svc = LocationService(location_db)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            location_label="Floor 2",
        )
        completed = svc.complete(ctx, row.id)
        assert completed.status == "historical"
        assert completed.is_current is False
        assert completed.effective_to is not None


def test_disposed_asset_blocked(location_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(location_db, ids, status="disposed")
    svc = LocationService(location_db)
    with _patched_audit(svc):
        with pytest.raises(LocationValidationError, match="Disposed"):
            svc.create(
                ctx,
                asset_id=asset.id,
                location_label="Invalid",
            )


def test_search_filters(location_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(location_db, ids)
    svc = LocationService(location_db)
    with _patched_audit(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            location_label="Searchable Warehouse",
        )
        items, total = svc.search(
            ctx,
            search="Searchable",
            is_current=True,
            offset=0,
            limit=25,
        )
        assert total >= 1
        assert any("Searchable" in item.location_label for item in items)
