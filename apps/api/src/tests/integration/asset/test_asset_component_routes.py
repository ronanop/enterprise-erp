"""HTTP-level integration tests for asset component routes (FP-ASSET-019)."""

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
from modules.asset.models.asset_component import AstAssetComponent
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

BASE = "/api/v1/assets/asset-components"


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


def _insert_asset(db: Session, ids: dict[str, object], *, company_id=None, status="active") -> AstAsset:
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
                    "component_code": "CMP-1",
                    "component_name": "Motor",
                },
            )
        assert response.status_code == 403
        assert "asset.component:create" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_install_replace_dispose_flow(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.component_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "component_code": "CMP-MOTOR",
                "component_name": "Drive Motor",
                "quantity": "1",
                "status": "disposed",
            },
        )
        assert create_resp.status_code == 200
        body = create_resp.json()["data"]
        assert body["status"] == "active"
        row_id = body["id"]

        tree_resp = client.get(f"{BASE}/tree", params={"asset_id": str(asset.id)})
        assert tree_resp.status_code == 200
        assert tree_resp.json()["data"]["depth"] == 1
        assert len(tree_resp.json()["data"]["components"]) == 1

        replace_resp = client.post(
            f"{BASE}/{row_id}/replace",
            json={"component_name": "Drive Motor v2", "serial_number": "SN-NEW"},
        )
        assert replace_resp.status_code == 200
        payload = replace_resp.json()["data"]
        assert payload["replaced"]["status"] == "replaced"
        assert payload["successor"]["status"] == "active"
        assert payload["successor"]["component_code"] == "CMP-MOTOR"
        successor_id = payload["successor"]["id"]

        hist = client.get(f"{BASE}/{successor_id}/history")
        assert hist.status_code == 200
        assert len(hist.json()["data"]["lineage"]) == 2

        dispose_resp = client.post(f"{BASE}/{successor_id}/dispose")
        assert dispose_resp.status_code == 200
        assert dispose_resp.json()["data"]["status"] == "disposed"


def test_list_returns_paginated_result(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.component_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "component_code": "CMP-A",
                "component_name": "Part A",
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
            "modules.asset.service.component_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        create_resp = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "component_code": "CMP-ISO",
                "component_name": "Isolated",
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
def test_company_mismatch_on_install_returns_422(
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
                "component_code": "CMP-X",
                "component_name": "Mismatch",
            },
        )
    assert response.status_code == 422
    assert "does not belong to this company" in response.json()["message"]


def test_install_blocked_on_disposed_asset(
    route_db: Session, route_ids: dict[str, object]
) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids, status="disposed")
    with _authed_client(route_db, ctx) as client:
        response = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "component_code": "CMP-D",
                "component_name": "Should Fail",
            },
        )
    assert response.status_code == 422
    assert "disposed or written-off" in response.json()["message"]


def test_update_active_component(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with (
        _authed_client(route_db, ctx) as client,
        patch(
            "modules.asset.service.component_service.AuditService.log_entity_change",
            return_value=None,
        ),
    ):
        created = client.post(
            BASE,
            json={
                "asset_id": str(asset.id),
                "component_code": "CMP-U",
                "component_name": "Before",
            },
        ).json()["data"]
        updated = client.patch(
            f"{BASE}/{created['id']}",
            json={"component_name": "After", "version": created["version"]},
        )
    assert updated.status_code == 200
    assert updated.json()["data"]["component_name"] == "After"


def test_openapi_includes_component_paths() -> None:
    client = TestClient(create_app())
    schema = client.get("/openapi.json").json()
    paths = schema["paths"]
    assert f"{BASE}" in paths or "/api/v1/assets/asset-components" in paths
    assert any("/asset-components/tree" in p for p in paths)
    assert any("/asset-components/{row_id}/replace" in p for p in paths)
    assert any("/asset-components/{row_id}/dispose" in p for p in paths)
    assert any("/asset-components/{row_id}/history" in p for p in paths)
