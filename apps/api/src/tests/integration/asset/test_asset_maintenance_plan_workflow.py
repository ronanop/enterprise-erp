"""Asset maintenance plan workflow integration tests (FP-ASSET-011)."""

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

from modules.asset.domain.exceptions import MaintenancePlanValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_maintenance_plan import AstAssetMaintenancePlan
from modules.asset.service.maintenance_plan_service import MaintenancePlanService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def plan_db():
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
        AstAssetMaintenancePlan.__table__,
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
        asset_name="Plan Asset",
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
def _patched_side_channels(svc: MaintenancePlanService):
    with (
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(
            svc._numbers,
            "generate",
            return_value="AMPL-2026-000001",
        ),
    ):
        yield


def test_draft_activate_pause_resume_close_lifecycle(plan_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(plan_db, ids)
    svc = MaintenancePlanService(plan_db)
    with _patched_side_channels(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            plan_name="Quarterly PM",
            maintenance_type="preventive",
            frequency_days=90,
            next_due_date=date(2026, 6, 1),
        )
        assert row.status == "draft"
        assert row.document_number == "AMPL-2026-000001"

        active = svc.activate(ctx, row.id)
        assert active.status == "active"

        paused = svc.pause(ctx, row.id)
        assert paused.status == "paused"

        resumed = svc.resume(ctx, row.id)
        assert resumed.status == "active"

        closed = svc.close(ctx, row.id)
        assert closed.status == "closed"


def test_activate_requires_next_due_date(plan_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(plan_db, ids)
    svc = MaintenancePlanService(plan_db)
    with _patched_side_channels(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            plan_name="No due date",
            maintenance_type="preventive",
        )
        with pytest.raises(MaintenancePlanValidationError, match="next_due_date"):
            svc.activate(ctx, row.id)


def test_disposed_asset_blocked(plan_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(plan_db, ids, status="disposed")
    svc = MaintenancePlanService(plan_db)
    with _patched_side_channels(svc):
        with pytest.raises(MaintenancePlanValidationError, match="Disposed"):
            svc.create(
                ctx,
                asset_id=asset.id,
                plan_name="Bad plan",
                maintenance_type="preventive",
            )


def test_close_rejects_draft(plan_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(plan_db, ids)
    svc = MaintenancePlanService(plan_db)
    with _patched_side_channels(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            plan_name="Draft only",
            maintenance_type="corrective",
        )
        with pytest.raises(MaintenancePlanValidationError, match="active or paused"):
            svc.close(ctx, row.id)


def test_search_filters(plan_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_active_asset(plan_db, ids)
    svc = MaintenancePlanService(plan_db)
    with _patched_side_channels(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            plan_name="Searchable Plan",
            maintenance_type="annual_service",
            next_due_date=date(2026, 12, 1),
        )
        items, total = svc.search(
            ctx,
            search="Searchable",
            maintenance_type="annual_service",
            offset=0,
            limit=25,
        )
        assert total >= 1
        assert any(r.plan_name == "Searchable Plan" for r in items)
