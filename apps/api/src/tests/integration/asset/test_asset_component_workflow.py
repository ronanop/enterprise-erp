"""Workflow / regression tests for asset components (FP-ASSET-019)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_component import AstAssetComponent
from modules.asset.service.component_service import AssetComponentService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def ids() -> dict[str, object]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "branch_id": uuid4(),
        "user_id": uuid4(),
        "category_id": uuid4(),
    }


@pytest.fixture
def db():
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
        AstAssetComponent.__table__,
    ]:
        table.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        raw.dispose()


def _ctx(ids: dict[str, object]) -> TenantContext:
    return TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="employee",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _asset(db: Session, ids: dict[str, object]) -> AstAsset:
    now = datetime.now(timezone.utc)
    db.merge(
        AstAssetCategory(
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
    )
    code = f"AST-{uuid4().hex[:6]}"
    asset = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Pump",
        asset_category_id=ids["category_id"],
        asset_type="fixed",
        currency_code="USD",
        purchase_cost=Decimal("1000"),
        salvage_value=Decimal("0"),
        current_book_value=Decimal("1000"),
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


def test_replace_preserves_code_history(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _asset(db, ids)
    svc = AssetComponentService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        first = svc.install(
            ctx,
            asset_id=asset.id,
            component_code="SEAL",
            component_name="Seal v1",
            quantity=Decimal("1"),
        )
        result = svc.replace(ctx, first.id, component_name="Seal v2", serial_number="S2")
    assert result["replaced"].status == "replaced"
    assert result["successor"].status == "active"
    assert result["successor"].component_code == "SEAL"
    hist = svc.history(ctx, result["successor"].id)
    assert len(hist["lineage"]) == 2
    statuses = [e["status"] for e in hist["lineage"]]
    assert statuses == ["replaced", "active"]


def test_dispose_is_terminal(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _asset(db, ids)
    svc = AssetComponentService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        row = svc.install(
            ctx,
            asset_id=asset.id,
            component_code="FILTER",
            component_name="Filter",
        )
        disposed = svc.dispose(ctx, row.id)
    assert disposed.status == "disposed"
    from modules.asset.domain.exceptions import ComponentValidationError

    with pytest.raises(ComponentValidationError):
        svc.dispose(ctx, disposed.id)
    with pytest.raises(ComponentValidationError):
        svc.replace(ctx, disposed.id)
    with pytest.raises(ComponentValidationError):
        svc.update(ctx, disposed.id, component_name="X", version=disposed.version)


def test_duplicate_active_code_blocked(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _asset(db, ids)
    svc = AssetComponentService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        svc.install(
            ctx,
            asset_id=asset.id,
            component_code="DUP",
            component_name="One",
        )
        from modules.asset.domain.exceptions import ComponentValidationError

        with pytest.raises(ComponentValidationError, match="already exists"):
            svc.install(
                ctx,
                asset_id=asset.id,
                component_code="DUP",
                component_name="Two",
            )


def test_tree_depth_is_one(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _asset(db, ids)
    svc = AssetComponentService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        svc.install(
            ctx,
            asset_id=asset.id,
            component_code="A",
            component_name="A",
        )
        svc.install(
            ctx,
            asset_id=asset.id,
            component_code="B",
            component_name="B",
        )
    tree = svc.tree(ctx, asset.id)
    assert tree["depth"] == 1
    assert len(tree["components"]) == 2
    assert "parent_component_id" not in tree


def test_search_pagination_sorting(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _asset(db, ids)
    svc = AssetComponentService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        for code in ("Z-PART", "A-PART", "M-PART"):
            svc.install(
                ctx,
                asset_id=asset.id,
                component_code=code,
                component_name=code,
            )
    items, total = svc.search(
        ctx, asset_id=asset.id, sort="component_code", offset=0, limit=2
    )
    assert total == 3
    assert len(items) == 2
