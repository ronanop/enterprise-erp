"""Asset service history workflow integration tests (FP-ASSET-013)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.domain.exceptions import ServiceHistoryValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_service_history import AstAssetServiceHistory
from modules.asset.service.service_history_service import ServiceHistoryService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def history_db():
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
        AstAssetMaintenance.__table__,
        AstAssetServiceHistory.__table__,
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


def _insert_asset(db: Session, ids: dict[str, object]) -> AstAsset:
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
    asset = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="History Asset",
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
    db.add(asset)
    db.flush()
    return asset


def _insert_completed_maintenance(
    db: Session,
    ids: dict[str, object],
    asset_id,
) -> AstAssetMaintenance:
    now = datetime.now(timezone.utc)
    row = AstAssetMaintenance(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"AMNT-2026-{uuid4().hex[:6]}",
        asset_id=asset_id,
        maintenance_type="preventive",
        status="completed",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
    )
    db.add(row)
    db.flush()
    return row


@contextmanager
def _patched_audit(svc: ServiceHistoryService):
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        yield


def test_manual_create_for_completed_maintenance(history_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(history_db, ids)
    maintenance = _insert_completed_maintenance(history_db, ids, asset.id)
    svc = ServiceHistoryService(history_db)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            maintenance_id=maintenance.id,
            service_summary="Supplemental filter replacement",
            cost_amount=Decimal("150.0000"),
        )
    assert row.status == "recorded"
    assert row.asset_id == asset.id
    assert row.maintenance_id == maintenance.id


def test_create_rejects_disposed_asset(history_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(history_db, ids)
    asset.status = "disposed"
    history_db.flush()
    maintenance = _insert_completed_maintenance(history_db, ids, asset.id)
    svc = ServiceHistoryService(history_db)
    with _patched_audit(svc):
        with pytest.raises(ServiceHistoryValidationError, match="permanently retired"):
            svc.create(
                ctx,
                asset_id=asset.id,
                maintenance_id=maintenance.id,
                service_summary="Should fail",
            )


def test_create_rejects_non_completed_maintenance(history_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(history_db, ids)
    now = datetime.now(timezone.utc)
    maintenance = AstAssetMaintenance(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=f"AMNT-2026-{uuid4().hex[:6]}",
        asset_id=asset.id,
        maintenance_type="corrective",
        status="in_progress",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["user_id"],
        updated_by=ids["user_id"],
    )
    history_db.add(maintenance)
    history_db.flush()
    svc = ServiceHistoryService(history_db)
    with _patched_audit(svc):
        with pytest.raises(ServiceHistoryValidationError, match="completed"):
            svc.create(
                ctx,
                asset_id=asset.id,
                maintenance_id=maintenance.id,
                service_summary="Should fail",
            )


def test_record_from_maintenance(history_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(history_db, ids)
    maintenance = _insert_completed_maintenance(history_db, ids, asset.id)
    svc = ServiceHistoryService(history_db)
    row = svc.record_from_maintenance(
        ctx,
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        asset_id=asset.id,
        maintenance_id=maintenance.id,
        service_summary="Preventive maintenance completed",
        cost_amount=Decimal("200.0000"),
    )
    assert row.status == "recorded"
    found = list(
        history_db.scalars(
            select(AstAssetServiceHistory).where(
                AstAssetServiceHistory.maintenance_id == maintenance.id
            )
        ).all()
    )
    assert len(found) == 1


def test_search_filters(history_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(history_db, ids)
    maintenance = _insert_completed_maintenance(history_db, ids, asset.id)
    svc = ServiceHistoryService(history_db)
    with _patched_audit(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            maintenance_id=maintenance.id,
            service_summary="Searchable belt replacement",
        )
    items, total = svc.search(
        ctx,
        asset_id=asset.id,
        search="Searchable",
        offset=0,
        limit=25,
    )
    assert total >= 1
    assert any("Searchable" in item.service_summary for item in items)
