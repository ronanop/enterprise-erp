"""Asset physical-audit workflow integration tests (FP-ASSET-008)."""

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

from modules.asset.domain.exceptions import AssetAuditValidationError
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_audit import AstAssetAudit
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.service.asset_audit_service import AssetAuditService
from modules.foundation.domain.value_objects import TenantContext


@pytest.fixture
def audit_db():
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
def ids() -> dict[str, object]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "branch_id": uuid4(),
        "user_id": uuid4(),
        "category_id": uuid4(),
        "auditor_id": uuid4(),
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
        asset_name="Audit Asset",
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
def _patched_side_channels(svc: AssetAuditService):
    with (
        patch.object(svc._numbers, "generate", return_value=f"AAUD-{uuid4().hex[:8]}"),
        patch.object(svc._audit, "log_entity_change", return_value=None),
        patch.object(
            svc._validator._master,
            "get_employee",
            return_value=SimpleNamespace(id=uuid4()),
        ),
    ):
        yield


def _create_audit(
    svc: AssetAuditService,
    ctx: TenantContext,
    ids: dict[str, object],
    asset: AstAsset,
    *,
    found_status: str | None = None,
):
    return svc.create(
        ctx,
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        asset_id=asset.id,
        auditor_employee_id=ids["auditor_id"],
        audit_date=date.today(),
        found_status=found_status,
        notes="Quarterly count",
    )


@pytest.mark.integration
def test_create_planned_captures_fields(audit_db, ids) -> None:
    asset = _insert_active_asset(audit_db, ids)
    svc = AssetAuditService(audit_db)
    with _patched_side_channels(svc):
        created = _create_audit(svc, _ctx(ids), ids, asset)

    assert created.status == "planned"
    assert created.asset_id == asset.id
    assert created.auditor_employee_id == ids["auditor_id"]
    assert created.audit_date == date.today()
    assert created.notes == "Quarterly count"


@pytest.mark.integration
def test_start_then_complete_with_found_status(audit_db, ids) -> None:
    asset = _insert_active_asset(audit_db, ids)
    svc = AssetAuditService(audit_db)
    with _patched_side_channels(svc):
        created = _create_audit(svc, _ctx(ids), ids, asset, found_status="found")
        started = svc.start(_ctx(ids), created.id)
        started_status = started.status
        found_status = started.found_status
        completed = svc.complete(_ctx(ids), created.id)

    assert started_status == "in_progress"
    assert found_status == "found"
    assert completed.status == "completed"


@pytest.mark.integration
def test_cancel_before_complete(audit_db, ids) -> None:
    asset = _insert_active_asset(audit_db, ids)
    svc = AssetAuditService(audit_db)
    with _patched_side_channels(svc):
        created = _create_audit(svc, _ctx(ids), ids, asset)
        cancelled = svc.cancel(_ctx(ids), created.id)

    assert cancelled.status == "cancelled"


@pytest.mark.integration
def test_disposed_asset_is_blocked_on_create(audit_db, ids) -> None:
    asset = _insert_active_asset(audit_db, ids, status="disposed")
    svc = AssetAuditService(audit_db)
    with _patched_side_channels(svc):
        with pytest.raises(AssetAuditValidationError, match="Disposed"):
            _create_audit(svc, _ctx(ids), ids, asset)


@pytest.mark.integration
def test_planned_update_works_but_update_after_start_fails(audit_db, ids) -> None:
    asset = _insert_active_asset(audit_db, ids)
    svc = AssetAuditService(audit_db)
    with _patched_side_channels(svc):
        created = _create_audit(svc, _ctx(ids), ids, asset)
        updated = svc.update(_ctx(ids), created.id, notes="Rescheduled", version=created.version)
        svc.start(_ctx(ids), created.id)
        with pytest.raises(AssetAuditValidationError, match="planned"):
            svc.update(_ctx(ids), created.id, notes="Too late", version=updated.version)

    assert updated.notes == "Rescheduled"
