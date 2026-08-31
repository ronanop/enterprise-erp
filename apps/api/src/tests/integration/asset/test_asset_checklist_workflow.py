"""Asset checklist workflow integration tests (FP-ASSET-014)."""

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

from core.exceptions import ConflictException
from modules.asset.domain.exceptions import ChecklistValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_checklist import AstAssetChecklist
from modules.asset.service.checklist_service import ChecklistService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def checklist_db():
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
    for table in [AstAssetCategory.__table__, AstAsset.__table__, AstAssetChecklist.__table__]:
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


def _insert_asset(
    db: Session,
    ids: dict[str, object],
    *,
    status: str = "active",
    company_id=None,
) -> AstAsset:
    now = datetime.now(timezone.utc)
    resolved_company_id = company_id or ids["company_id"]
    category = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=ids["tenant_id"],
        company_id=resolved_company_id,
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
        company_id=resolved_company_id,
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Checklist Asset",
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
        status=status,
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


@contextmanager
def _patched_audit(svc: ChecklistService):
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        yield


def test_create_and_complete_checklist(checklist_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(checklist_db, ids)
    svc = ChecklistService(checklist_db)
    items = {"items": [{"label": "Inspect housing", "required": True, "result": "pass"}]}
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            checklist_code="CHK-001",
            checklist_name="Safety inspection",
            items_json=items,
        )
    assert row.status == "draft"
    with _patched_audit(svc):
        completed = svc.complete(ctx, row.id)
    assert completed.status == "completed"
    assert completed.completed_at is not None


def test_complete_requires_item_results(checklist_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(checklist_db, ids)
    svc = ChecklistService(checklist_db)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            checklist_code="CHK-002",
            checklist_name="Incomplete",
            items_json={"items": [{"label": "Inspect housing", "required": True}]},
        )
        with pytest.raises(ChecklistValidationError, match="requires a result"):
            svc.complete(ctx, row.id)


def test_cancel_draft_checklist(checklist_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(checklist_db, ids)
    svc = ChecklistService(checklist_db)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            checklist_code="CHK-003",
            checklist_name="Cancelled",
        )
        cancelled = svc.cancel(ctx, row.id)
    assert cancelled.status == "cancelled"


def test_update_only_while_draft(checklist_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(checklist_db, ids)
    svc = ChecklistService(checklist_db)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            checklist_code="CHK-004",
            checklist_name="Editable",
            items_json={"items": [{"label": "Inspect housing", "required": True, "result": "pass"}]},
        )
        updated = svc.update(
            ctx,
            row.id,
            checklist_name="Updated name",
            version=row.version,
        )
        assert updated.checklist_name == "Updated name"
        completed = svc.complete(ctx, row.id)
    with pytest.raises(ChecklistValidationError, match="Only draft"):
        svc.update(ctx, completed.id, checklist_name="Too late", version=completed.version)


def test_search_filters_by_asset(checklist_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(checklist_db, ids)
    svc = ChecklistService(checklist_db)
    with _patched_audit(svc):
        svc.create(
            ctx,
            asset_id=asset.id,
            checklist_code="CHK-005",
            checklist_name="Searchable",
        )
    items, total = svc.search(ctx, asset_id=asset.id, search="Searchable", offset=0, limit=25)
    assert total >= 1
    assert any(row.checklist_name == "Searchable" for row in items)


def test_update_optimistic_lock_conflict(checklist_db: Session, ids: dict[str, object]):
    ctx = _ctx(ids)
    asset = _insert_asset(checklist_db, ids)
    svc = ChecklistService(checklist_db)
    with _patched_audit(svc):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            checklist_code="CHK-006",
            checklist_name="Versioned",
        )
        with pytest.raises(ConflictException):
            svc.update(ctx, row.id, checklist_name="Stale", version=999)


def test_create_rejects_asset_company_mismatch_for_admin(checklist_db: Session, ids: dict[str, object]):
    ctx = TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="tenant_admin",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )
    other_company_id = uuid4()
    asset = _insert_asset(checklist_db, ids, company_id=other_company_id)
    svc = ChecklistService(checklist_db)
    with _patched_audit(svc):
        with pytest.raises(ChecklistValidationError, match="does not belong to this company"):
            svc.create(
                ctx,
                asset_id=asset.id,
                checklist_code="CHK-007",
                checklist_name="Wrong company asset",
            )
