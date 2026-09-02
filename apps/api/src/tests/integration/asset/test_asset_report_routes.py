"""HTTP integration tests for asset reports (FP-ASSET-018)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from database.session import get_db
from main import create_app
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
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

BASE = "/api/v1/assets/reports"

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
def route_ids() -> dict[str, object]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "other_tenant_id": uuid4(),
        "branch_id": uuid4(),
        "user_id": uuid4(),
        "category_id": uuid4(),
    }


@pytest.fixture
def route_db():
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
        schema_translate_map={"asset": None, "foundation": None, "master": None, "organization": None}
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


def _ctx(ids: dict[str, object], *, tenant_id=None) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id or ids["tenant_id"],
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
        asset_name="Report Asset",
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


@contextmanager
def _authed_client(route_db: Session, ctx: TenantContext):
    app = create_app()

    def override_db():
        try:
            yield route_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_tenant_context] = lambda: ctx
    client = TestClient(app)
    try:
        with patch(
            "modules.foundation.dependencies.RBACService.has_permission",
            return_value=True,
        ):
            yield client
    finally:
        app.dependency_overrides.clear()


def test_list_requires_authentication() -> None:
    assert TestClient(create_app()).get(BASE).status_code == 401


def test_export_requires_permission(route_db: Session, route_ids: dict[str, object]) -> None:
    app = create_app()
    ctx = _ctx(route_ids)

    def override_db():
        try:
            yield route_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_tenant_context] = lambda: ctx
    client = TestClient(app)
    try:
        with patch(
            "modules.foundation.dependencies.RBACService.has_permission",
            return_value=False,
        ):
            response = client.get(f"{BASE}/export/asset_summary")
        assert response.status_code == 403
        assert "asset.report:export" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_catalog_and_dashboard(route_db: Session, route_ids: dict[str, object]) -> None:
    _insert_asset(route_db, route_ids)
    with _authed_client(route_db, _ctx(route_ids)) as client:
        catalog = client.get(f"{BASE}/catalog")
        assert catalog.status_code == 200
        keys = {i["key"] for i in catalog.json()["data"]}
        assert "asset_inventory" in keys

        dash = client.get(f"{BASE}/dashboard")
        assert dash.status_code == 200
        assert dash.json()["data"]["kpis"]["asset_count"] >= 1


def test_run_inventory_paginated(route_db: Session, route_ids: dict[str, object]) -> None:
    _insert_asset(route_db, route_ids)
    with _authed_client(route_db, _ctx(route_ids)) as client:
        resp = client.get(f"{BASE}/run/asset_inventory?page=1&page_size=10")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["total"] >= 1
    assert "items" in body


def test_generate_finalize(route_db: Session, route_ids: dict[str, object]) -> None:
    _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, _ctx(route_ids)) as client,
        patch(
            "modules.asset.service.asset_report_service.DocumentNumberService.generate",
            return_value="ARPT-2026-000099",
        ),
        patch(
            "modules.asset.service.asset_report_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        gen = client.post(f"{BASE}/generate", json={"report_key": "asset_summary"})
        assert gen.status_code == 200
        body = gen.json()["data"]
        assert body["status"] == "draft"
        assert body["report_type"] == "register"
        row_id = body["id"]
        fin = client.post(f"{BASE}/{row_id}/finalize")
        assert fin.status_code == 200
        assert fin.json()["data"]["status"] == "finalized"


def test_invalid_report_key(route_db: Session, route_ids: dict[str, object]) -> None:
    with _authed_client(route_db, _ctx(route_ids)) as client:
        resp = client.get(f"{BASE}/run/not_real")
    assert resp.status_code == 422


def test_tenant_isolation(route_db: Session, route_ids: dict[str, object]) -> None:
    _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, _ctx(route_ids)) as client,
        patch(
            "modules.asset.service.asset_report_service.DocumentNumberService.generate",
            return_value="ARPT-2026-000100",
        ),
        patch(
            "modules.asset.service.asset_report_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        gen = client.post(f"{BASE}/generate", json={"report_key": "asset_summary"})
        row_id = gen.json()["data"]["id"]

    other = _ctx(route_ids, tenant_id=route_ids["other_tenant_id"])
    with _authed_client(route_db, other) as client:
        assert client.get(f"{BASE}/{row_id}").status_code == 404


def test_openapi_report_paths() -> None:
    paths = create_app().openapi().get("paths", {})
    assert any("/reports/catalog" in p for p in paths)
    assert any("/reports/dashboard" in p for p in paths)
    assert any("/reports/run/" in p for p in paths)
    assert any("/export/" in p for p in paths)
    assert any("/finalize" in p for p in paths)


def test_list_snapshots_paginated(route_db: Session, route_ids: dict[str, object]) -> None:
    _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, _ctx(route_ids)) as client,
        patch(
            "modules.asset.service.asset_report_service.DocumentNumberService.generate",
            return_value="ARPT-2026-000101",
        ),
        patch(
            "modules.asset.service.asset_report_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        client.post(f"{BASE}/generate", json={"report_key": "asset_summary"})
        listing = client.get(BASE)
    payload = listing.json()["data"]
    assert "items" in payload
    assert payload["total"] >= 1
