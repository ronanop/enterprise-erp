"""FP-ASSET-014 regression guards — Maintenance and Audit remain unchanged."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_audit import AstAssetAudit
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.service.asset_audit_service import AssetAuditService
from modules.asset.service.maintenance_service import MaintenanceService
from modules.foundation.domain.value_objects import TenantContext
from tests.integration.asset.conftest import insert_active_asset, seed_ast_maintenance_approval
from tests.integration.asset.test_asset_maintenance_workflow import (
    _ctx as maintenance_ctx,
    _enable_governance,
    _insert_draft_maintenance,
    _silence_side_channels,
)


def test_maintenance_service_has_no_checklist_coupling() -> None:
    import inspect

    source = inspect.getsource(MaintenanceService)
    lowered = source.lower()
    assert "checklistservice" not in lowered
    assert "checklist_validator" not in lowered


def test_audit_service_has_no_checklist_coupling() -> None:
    import inspect

    source = inspect.getsource(AssetAuditService)
    lowered = source.lower()
    assert "checklistservice" not in lowered
    assert "checklist_validator" not in lowered


@pytest.mark.integration
def test_maintenance_cancel_draft_regression(wf_db, tenant_ids) -> None:
    seed_ast_maintenance_approval(wf_db, tenant_ids["tenant_id"], tenant_ids["creator_id"])
    asset = insert_active_asset(wf_db, tenant_ids)
    maintenance = _insert_draft_maintenance(wf_db, tenant_ids, asset.id)
    svc = MaintenanceService(wf_db)
    creator_ctx = maintenance_ctx(tenant_ids)
    patches = _silence_side_channels()
    with _enable_governance(), patches[0], patches[1], patches[2], patches[3]:
        cancelled = svc.cancel_draft(creator_ctx, maintenance.id)
    assert cancelled.status == "cancelled"


@pytest.fixture
def audit_regression_db():
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
    for table in [AstAssetCategory.__table__, AstAsset.__table__, AstAssetAudit.__table__]:
        table.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
        session.rollback()
    finally:
        session.close()
        raw.dispose()


@pytest.fixture
def audit_regression_ids() -> dict[str, object]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "branch_id": uuid4(),
        "user_id": uuid4(),
        "category_id": uuid4(),
        "auditor_id": uuid4(),
    }


def _audit_ctx(ids: dict[str, object]) -> TenantContext:
    return TenantContext(
        tenant_id=ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="employee",
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _insert_audit_asset(db: Session, ids: dict[str, object]) -> AstAsset:
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
        asset_name="Regression Asset",
        asset_category_id=ids["category_id"],
        asset_type="fixed",
        currency_code="USD",
        purchase_cost=Decimal("12000"),
        salvage_value=Decimal("0"),
        current_book_value=Decimal("12000"),
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


@pytest.mark.integration
def test_audit_create_planned_regression(audit_regression_db: Session, audit_regression_ids: dict) -> None:
    asset = _insert_audit_asset(audit_regression_db, audit_regression_ids)
    svc = AssetAuditService(audit_regression_db)
    ctx = _audit_ctx(audit_regression_ids)
    with (
        patch.object(svc._numbers, "generate", return_value=f"AAUD-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(
            svc._validator._master,
            "get_employee",
            return_value=SimpleNamespace(id=audit_regression_ids["auditor_id"]),
        ),
    ):
        created = svc.create(
            ctx,
            company_id=audit_regression_ids["company_id"],
            branch_id=audit_regression_ids["branch_id"],
            asset_id=asset.id,
            auditor_employee_id=audit_regression_ids["auditor_id"],
            audit_date=date.today(),
            notes="Regression audit",
        )
    assert created.status == "planned"
    assert created.asset_id == asset.id
