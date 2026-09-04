"""Lifecycle / regression tests for asset notifications (FP-ASSET-017)."""

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
from modules.asset.models.asset_notification import AstAssetNotification
from modules.asset.service.notification_service import AssetNotificationService
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.service import notification_service as foundation_notification


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
        AstAssetNotification.__table__,
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


def _insert_asset(db: Session, ids: dict[str, object]) -> AstAsset:
    now = datetime.now(timezone.utc)
    category = AstAssetCategory(
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
    db.merge(category)
    code = f"AST-{uuid4().hex[:8]}"
    asset = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Ntf Asset",
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


def test_search_filters_by_type(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _insert_asset(db, ids)
    svc = AssetNotificationService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        svc.create(
            ctx,
            asset_id=asset.id,
            notification_type="maintenance_due",
            recipient_user_id=ids["user_id"],
        )
        svc.create(
            ctx,
            asset_id=asset.id,
            notification_type="depreciation",
            recipient_user_id=ids["user_id"],
        )
        items, total = svc.search(ctx, notification_type="maintenance_due")
    assert total == 1
    assert items[0].notification_type == "maintenance_due"


def test_failed_then_sent_allowed(db: Session, ids: dict[str, object]) -> None:
    ctx = _ctx(ids)
    asset = _insert_asset(db, ids)
    svc = AssetNotificationService(db)
    with patch.object(svc._audit, "log_entity_change", return_value=None):
        row = svc.create(
            ctx,
            asset_id=asset.id,
            notification_type="insurance_expiry",
            recipient_user_id=ids["user_id"],
        )
        failed = svc.mark_failed(ctx, row.id)
        assert failed.delivery_status == "failed"
        sent = svc.mark_sent(ctx, row.id)
        assert sent.delivery_status == "sent"


def test_foundation_notification_module_untouched() -> None:
    """Regression: Asset NTF must not replace Foundation NotificationService.send."""
    assert hasattr(foundation_notification.NotificationService, "send")
    assert hasattr(foundation_notification.NotificationService, "list_templates")
