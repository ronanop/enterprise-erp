"""Workflow / regression tests for asset reports (FP-ASSET-018)."""

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
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_depreciation import AstAssetDepreciation
from modules.asset.models.asset_insurance import AstAssetInsurance
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_notification import AstAssetNotification
from modules.asset.models.asset_report import AstAssetReport
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.models.asset_warranty import AstAssetWarranty
from modules.asset.service.asset_report_service import AssetReportService
from modules.foundation.domain.value_objects import TenantContext

_TABLES = [
    AstAssetCategory.__table__,
    AstAsset.__table__,
    AstAssetAssignment.__table__,
    AstAssetWarranty.__table__,
    AstAssetInsurance.__table__,
    AstAssetMaintenance.__table__,
    AstAssetDepreciation.__table__,
    AstAssetTransfer.__table__,
    AstAssetNotification.__table__,
    AstAssetReport.__table__,
]


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
        schema_translate_map={"asset": None, "foundation": None, "organization": None}
    )
    for table in _TABLES:
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


def _seed(db: Session, ids: dict[str, object]) -> None:
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
    db.add(
        AstAsset(
            id=uuid4(),
            tenant_id=ids["tenant_id"],
            company_id=ids["company_id"],
            branch_id=ids["branch_id"],
            document_number=code,
            asset_code=code,
            asset_name="A",
            asset_category_id=ids["category_id"],
            asset_type="fixed",
            currency_code="USD",
            purchase_cost=Decimal("1"),
            salvage_value=Decimal("0"),
            current_book_value=Decimal("1"),
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
    )
    db.flush()


def test_dashboard_and_run_read_only(db: Session, ids: dict[str, object]) -> None:
    _seed(db, ids)
    svc = AssetReportService(db)
    ctx = _ctx(ids)
    dash = svc.dashboard(ctx)
    assert dash["kpis"]["asset_count"] >= 1
    run = svc.run(ctx, "asset_inventory", page=1, page_size=10)
    assert run["total"] >= 1
    from sqlalchemy import select

    asset = db.scalar(select(AstAsset).where(AstAsset.is_deleted.is_(False)))
    assert asset is not None
    assert asset.status == "active"
    assert asset.version == 1


def test_generate_writes_only_report_table(db: Session, ids: dict[str, object]) -> None:
    _seed(db, ids)
    svc = AssetReportService(db)
    ctx = _ctx(ids)
    with (
        patch.object(svc._numbers, "generate", return_value="ARPT-T-1"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        row = svc.generate(ctx, report_key="asset_summary")
    assert row.status == "draft"
    assert row.metrics_json is not None
    from sqlalchemy import select, func

    assert db.scalar(select(func.count()).select_from(AstAssetReport)) == 1
    asset = db.scalar(select(AstAsset))
    assert asset.version == 1


def test_finalize_immutable_update(db: Session, ids: dict[str, object]) -> None:
    _seed(db, ids)
    svc = AssetReportService(db)
    ctx = _ctx(ids)
    with (
        patch.object(svc._numbers, "generate", return_value="ARPT-T-2"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
    ):
        row = svc.generate(ctx, report_key="asset_summary")
        finalized = svc.finalize(ctx, row.id)
    assert finalized.status == "finalized"
    from modules.asset.domain.exceptions import ReportValidationError
    import pytest

    with pytest.raises(ReportValidationError):
        svc.update(ctx, row.id, version=int(finalized.version or 1), period_start=date(2026, 1, 1))


def test_analytics_module_untouched() -> None:
    from modules.analytics import permissions as analytics_permissions

    codes = [p[0] for p in analytics_permissions.ANALYTICS_PERMISSIONS]
    assert any(c.startswith("analytics.report:") for c in codes)
