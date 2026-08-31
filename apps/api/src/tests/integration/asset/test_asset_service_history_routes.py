"""HTTP-level integration tests for service history routes (FP-ASSET-013 remediation)."""

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
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_service_history import AstAssetServiceHistory
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

BASE = "/api/v1/assets/service-histories"


@pytest.fixture
def route_ids() -> dict[str, object]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "other_company_id": uuid4(),
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


def _ctx(ids: dict[str, object], *, tenant_id=None, company_id=None) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id or ids["tenant_id"],
        user_id=ids["user_id"],
        user_type="employee",
        company_id=company_id or ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _insert_asset(
    db: Session,
    ids: dict[str, object],
    *,
    company_id=None,
    tenant_id=None,
    status: str = "active",
) -> AstAsset:
    now = datetime.now(timezone.utc)
    category = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=tenant_id or ids["tenant_id"],
        company_id=company_id or ids["company_id"],
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
        tenant_id=tenant_id or ids["tenant_id"],
        company_id=company_id or ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Route Asset",
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


def _insert_completed_maintenance(
    db: Session,
    ids: dict[str, object],
    asset: AstAsset,
) -> AstAssetMaintenance:
    now = datetime.now(timezone.utc)
    row = AstAssetMaintenance(
        id=uuid4(),
        tenant_id=asset.tenant_id,
        company_id=asset.company_id,
        branch_id=asset.branch_id,
        document_number=f"AMNT-2026-{uuid4().hex[:6]}",
        asset_id=asset.id,
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
    client = TestClient(create_app())
    response = client.get(BASE)
    assert response.status_code == 401


def test_create_requires_authentication() -> None:
    client = TestClient(create_app())
    response = client.post(
        BASE,
        json={
            "asset_id": str(uuid4()),
            "maintenance_id": str(uuid4()),
            "service_summary": "Unauthorized",
        },
    )
    assert response.status_code == 401


def test_list_requires_read_permission(route_db: Session, route_ids: dict[str, object]) -> None:
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
            response = client.get(BASE)
        assert response.status_code == 403
        assert "asset.maintenance:read" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_create_requires_create_permission(route_db: Session, route_ids: dict[str, object]) -> None:
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
            response = client.post(
                BASE,
                json={
                    "asset_id": str(uuid4()),
                    "maintenance_id": str(uuid4()),
                    "service_summary": "Forbidden",
                },
            )
        assert response.status_code == 403
        assert "asset.maintenance:create" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_list_returns_paginated_result(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    maintenance = _insert_completed_maintenance(route_db, route_ids, asset)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.service_history_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "maintenance_id": str(maintenance.id),
                "service_summary": "HTTP create",
            },
        )
        assert create_resp.status_code == 200
        list_resp = client.get(BASE)
    assert list_resp.status_code == 200
    payload = list_resp.json()["data"]
    assert "items" in payload
    assert "total" in payload
    assert payload["total"] >= 1


def test_create_rejects_invalid_payload(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    with _authed_client(route_db, ctx) as client:
        response = client.post(
            BASE,
            json={
                "asset_id": str(uuid4()),
                "maintenance_id": str(uuid4()),
                "service_summary": "",
            },
        )
    assert response.status_code == 422


def test_create_success(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    maintenance = _insert_completed_maintenance(route_db, route_ids, asset)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.service_history_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        response = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "maintenance_id": str(maintenance.id),
                "service_summary": "Successful HTTP entry",
                "status": "void",
            },
        )
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["status"] == "recorded"
    assert body["service_summary"] == "Successful HTTP entry"


def test_tenant_isolation(route_db: Session, route_ids: dict[str, object]) -> None:
    asset = _insert_asset(route_db, route_ids)
    maintenance = _insert_completed_maintenance(route_db, route_ids, asset)
    owner_ctx = _ctx(route_ids)
    with (
        _authed_client(route_db, owner_ctx) as client,
        patch(
            "modules.asset.service.service_history_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "maintenance_id": str(maintenance.id),
                "service_summary": "Tenant scoped",
            },
        )
        assert create_resp.status_code == 200
        row_id = create_resp.json()["data"]["id"]

    other_ctx = _ctx(route_ids, tenant_id=route_ids["other_tenant_id"])
    with _authed_client(route_db, other_ctx) as client:
        list_resp = client.get(BASE)
        get_resp = client.get(f"{BASE}/{row_id}")
    assert list_resp.json()["data"]["total"] == 0
    assert get_resp.status_code == 404


def test_company_isolation_on_create(route_db: Session, route_ids: dict[str, object]) -> None:
    asset = _insert_asset(route_db, route_ids, company_id=route_ids["company_id"])
    maintenance = _insert_completed_maintenance(route_db, route_ids, asset)
    other_ctx = _ctx(route_ids, company_id=route_ids["other_company_id"])
    with _authed_client(route_db, other_ctx) as client:
        response = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "maintenance_id": str(maintenance.id),
                "service_summary": "Wrong company",
            },
        )
    assert response.status_code == 422
    assert response.json()["success"] is False
