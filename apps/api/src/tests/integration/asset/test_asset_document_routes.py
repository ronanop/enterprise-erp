"""HTTP-level integration tests for asset document routes (FP-ASSET-016)."""

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
from modules.asset.models.asset_document import AstAssetDocument
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

BASE = "/api/v1/assets/asset-documents"


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
        AstAssetDocument.__table__,
    ]:
        table.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.rollback()
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


def _insert_asset(db: Session, ids: dict[str, object], *, company_id=None) -> AstAsset:
    now = datetime.now(timezone.utc)
    category = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=ids["tenant_id"],
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
        tenant_id=ids["tenant_id"],
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
                    "document_type": "invoice",
                    "document_name": "INV",
                },
            )
        assert response.status_code == 403
        assert "asset.document:create" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_create_success_supersede_archive(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.document_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "document_type": "invoice",
                "document_name": "Invoice A",
                "storage_uri": "https://cdn.example.com/a.pdf",
                "status": "archived",
            },
        )
        assert create_resp.status_code == 200
        body = create_resp.json()["data"]
        assert body["status"] == "active"
        row_id = body["id"]
        supersede_resp = client.post(f"{BASE}/{row_id}/supersede")
        assert supersede_resp.status_code == 200
        assert supersede_resp.json()["data"]["status"] == "superseded"
        archive_resp = client.post(f"{BASE}/{row_id}/archive")
    assert archive_resp.status_code == 200
    assert archive_resp.json()["data"]["status"] == "archived"


def test_create_rejects_unsafe_storage_uri(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with _authed_client(route_db, ctx) as client:
        response = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "document_type": "invoice",
                "document_name": "Bad",
                "storage_uri": "javascript:alert(1)",
            },
        )
    assert response.status_code == 422
    assert "not allowed" in response.json()["message"] or "scheme" in response.json()["message"]


def test_list_returns_paginated_result(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.document_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "document_type": "manual",
                "document_name": "Manual",
            },
        )
        list_resp = client.get(BASE)
    payload = list_resp.json()["data"]
    assert "items" in payload
    assert payload["total"] >= 1


def test_tenant_isolation(route_db: Session, route_ids: dict[str, object]) -> None:
    asset = _insert_asset(route_db, route_ids)
    owner_ctx = _ctx(route_ids)
    with (
        _authed_client(route_db, owner_ctx) as client,
        patch(
            "modules.asset.service.document_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "document_type": "photo",
                "document_name": "Photo",
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
    with _authed_client(route_db, ctx) as client:
        response = client.post(
            BASE,
            json={
                "company_id": str(route_ids["other_company_id"]),
                "asset_id": str(asset.id),
                "document_type": "invoice",
                "document_name": "Mismatch",
            },
        )
    assert response.status_code == 422
    assert "does not belong to this company" in response.json()["message"]


def _create_active(route_db: Session, route_ids: dict[str, object]) -> str:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.document_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "document_type": "warranty",
                "document_name": "Warranty Card",
            },
        )
    return create_resp.json()["data"]["id"]


def test_supersede_requires_update_permission(
    route_db: Session, route_ids: dict[str, object]
) -> None:
    row_id = _create_active(route_db, route_ids)
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
            response = client.post(f"{BASE}/{row_id}/supersede")
        assert response.status_code == 403
        assert "asset.document:update" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()
