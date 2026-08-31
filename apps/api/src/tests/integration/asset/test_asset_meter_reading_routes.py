"""HTTP-level integration tests for meter reading routes (FP-ASSET-015)."""

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
from modules.asset.models.asset_meter_reading import AstAssetMeterReading
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

BASE = "/api/v1/assets/meter-readings"


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
        AstAssetMeterReading.__table__,
    ]:
        table.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
        session.rollback()
    finally:
        session.close()
        raw.dispose()


def _ctx(
    ids: dict[str, object],
    *,
    tenant_id=None,
    company_id=None,
    user_type: str = "employee",
) -> TenantContext:
    return TenantContext(
        tenant_id=tenant_id or ids["tenant_id"],
        user_id=ids["user_id"],
        user_type=user_type,
        company_id=company_id or ids["company_id"],
        branch_id=ids["branch_id"],
    )


def _insert_asset(
    db: Session,
    ids: dict[str, object],
    *,
    company_id=None,
    tenant_id=None,
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
    client = TestClient(create_app())
    assert client.get(BASE).status_code == 401


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
                    "meter_type": "odometer",
                    "reading_value": "100",
                    "reading_at": datetime.now(timezone.utc).isoformat(),
                },
            )
        assert response.status_code == 403
        assert "asset.meter:create" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_create_success_and_void(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    when = datetime.now(timezone.utc).isoformat()
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.meter_reading_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "meter_type": "odometer",
                "reading_value": "1000",
                "reading_at": when,
                "status": "void",
            },
        )
        assert create_resp.status_code == 200
        body = create_resp.json()["data"]
        assert body["status"] == "recorded"
        row_id = body["id"]
        void_resp = client.post(f"{BASE}/{row_id}/void")
    assert void_resp.status_code == 200
    assert void_resp.json()["data"]["status"] == "void"


def test_list_returns_paginated_result(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    when = datetime.now(timezone.utc).isoformat()
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.meter_reading_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "meter_type": "odometer",
                "reading_value": "200",
                "reading_at": when,
            },
        )
        list_resp = client.get(BASE)
    payload = list_resp.json()["data"]
    assert "items" in payload
    assert payload["total"] >= 1


def test_tenant_isolation(route_db: Session, route_ids: dict[str, object]) -> None:
    asset = _insert_asset(route_db, route_ids)
    owner_ctx = _ctx(route_ids)
    when = datetime.now(timezone.utc).isoformat()
    with (
        _authed_client(route_db, owner_ctx) as client,
        patch(
            "modules.asset.service.meter_reading_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "meter_type": "odometer",
                "reading_value": "300",
                "reading_at": when,
            },
        )
        row_id = create_resp.json()["data"]["id"]
    other_ctx = _ctx(route_ids, tenant_id=route_ids["other_tenant_id"])
    with _authed_client(route_db, other_ctx) as client:
        list_resp = client.get(BASE)
        get_resp = client.get(f"{BASE}/{row_id}")
    assert list_resp.json()["data"]["total"] == 0
    assert get_resp.status_code == 404


@pytest.mark.parametrize("user_type", ["tenant_admin", "super_admin"])
def test_company_mismatch_on_create_returns_422(
    route_db: Session, route_ids: dict[str, object], user_type: str
) -> None:
    asset = _insert_asset(route_db, route_ids, company_id=route_ids["company_id"])
    ctx = _ctx(route_ids, company_id=route_ids["other_company_id"], user_type=user_type)
    when = datetime.now(timezone.utc).isoformat()
    with _authed_client(route_db, ctx) as client:
        response = client.post(
            BASE,
            json={
                "company_id": str(route_ids["other_company_id"]),
                "asset_id": str(asset.id),
                "meter_type": "odometer",
                "reading_value": "400",
                "reading_at": when,
            },
        )
    assert response.status_code == 422
    assert "does not belong to this company" in response.json()["message"]


def _create_recorded(route_db: Session, route_ids: dict[str, object]) -> str:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    when = datetime.now(timezone.utc).isoformat()
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.meter_reading_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "meter_type": "odometer",
                "reading_value": "500",
                "reading_at": when,
            },
        )
    return create_resp.json()["data"]["id"]


def test_void_requires_update_permission(route_db: Session, route_ids: dict[str, object]) -> None:
    row_id = _create_recorded(route_db, route_ids)
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
            response = client.post(f"{BASE}/{row_id}/void")
        assert response.status_code == 403
        assert "asset.meter:update" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()
