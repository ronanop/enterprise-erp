"""HTTP-level integration tests for asset transfer create (BUG-TRF-CREATE-01)."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine, event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from main import create_app
from modules.asset.dependencies import get_db as asset_get_db
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_location import AstAssetLocation
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.foundation.dependencies import get_tenant_context
from modules.foundation.domain.value_objects import TenantContext

BASE = "/api/v1/assets/asset-transfers"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, compiler, **_kw):  # noqa: ANN001
    return compiler.visit_JSON(JSON())


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
        schema_translate_map={"asset": None, "foundation": None, "master": None, "audit": None}
    )
    for table in [
        AstAssetCategory.__table__,
        AstAsset.__table__,
        AstAssetTransfer.__table__,
        AstAssetAssignment.__table__,
        AstAssetLocation.__table__,
    ]:
        table.create(bind=engine, checkfirst=True)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.rollback()
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
    status: str = "active",
    operational_status: str = "READY_TO_MOVE",
    company_id=None,
    tenant_id=None,
) -> AstAsset:
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
        tenant_id=tenant_id or ids["tenant_id"],
        company_id=company_id or ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="Transfer Route Asset",
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
        operational_status=operational_status,
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
def _authed_client(route_db: Session, ctx: TenantContext, *, allowed: bool = True):
    app = create_app()

    def override_db():
        try:
            yield route_db
        finally:
            pass

    app.dependency_overrides[asset_get_db] = override_db
    app.dependency_overrides[get_tenant_context] = lambda: ctx
    client = TestClient(app)
    try:
        with patch(
            "modules.foundation.dependencies.RBACService.has_permission",
            return_value=allowed,
        ):
            yield client
    finally:
        app.dependency_overrides.clear()


def _create_side_channel_patches(company_id):
    return (
        patch(
            "modules.asset.service.transfer_service.DocumentNumberService.generate",
            side_effect=lambda *a, **k: f"ATRF-{uuid4().hex[:8]}",
        ),
        patch(
            "modules.asset.service.transfer_service.AuditService.log_entity_change",
        ),
        patch(
            "modules.asset.adapters.organization_port.AssetOrganizationAdapter.get_branch",
            return_value=SimpleNamespace(company_id=company_id),
        ),
    )


def test_list_requires_authentication() -> None:
    client = TestClient(create_app())
    assert client.get(BASE).status_code == 401


def test_create_requires_create_permission(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    with _authed_client(route_db, ctx, allowed=False) as client:
        response = client.post(
            BASE,
            json={
                "branch_id": str(asset.branch_id),
                "asset_id": str(asset.id),
                "to_location_label": "Dest",
            },
        )
    assert response.status_code == 403
    assert "asset.transfer:create" in response.json()["message"]


def test_create_draft_success_same_and_cross_branch(
    route_db: Session, route_ids: dict[str, object]
) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    to_branch_id = uuid4()
    patches = _create_side_channel_patches(route_ids["company_id"])

    with _authed_client(route_db, ctx) as client, patches[0], patches[1] as mock_audit, patches[2]:
        same = client.post(
            BASE,
            json={
                "branch_id": str(asset.branch_id),
                "company_id": str(route_ids["company_id"]),
                "asset_id": str(asset.id),
                "to_branch_id": str(asset.branch_id),
                "to_location_label": "Same branch room",
                "reason": "relocate",
            },
        )
        assert same.status_code == 200, same.text
        same_body = same.json()["data"]
        assert same_body["status"] == "draft"
        assert same_body["asset_id"] == str(asset.id)
        assert same_body["company_id"] == str(route_ids["company_id"])
        assert same_body["to_location_label"] == "Same branch room"

        # Second create would hit pending-transfer gate — cancel first via status update in DB
        row = route_db.scalar(
            select(AstAssetTransfer).where(AstAssetTransfer.id == UUID(same_body["id"]))
        )
        assert row is not None
        row.status = "cancelled"
        route_db.flush()

        cross = client.post(
            BASE,
            json={
                "branch_id": str(asset.branch_id),
                "company_id": str(route_ids["company_id"]),
                "asset_id": str(asset.id),
                "to_branch_id": str(to_branch_id),
                "to_location_label": "Cross branch lab",
                "reason": "office move",
                "transfer_notes": "note",
            },
        )
        assert cross.status_code == 200, cross.text
        cross_body = cross.json()["data"]
        assert cross_body["status"] == "draft"
        assert cross_body["asset_id"] == str(asset.id)
        assert cross_body["company_id"] == str(route_ids["company_id"])
        assert cross_body["to_branch_id"] == str(to_branch_id)
        assert cross_body["to_location_label"] == "Cross branch lab"
        assert cross_body["reason"] == "office move"
        assert cross_body["transfer_notes"] == "note"
        assert mock_audit.called

    drafts = list(
        route_db.scalars(
            select(AstAssetTransfer).where(
                AstAssetTransfer.asset_id == asset.id,
                AstAssetTransfer.status == "draft",
                AstAssetTransfer.is_deleted.is_(False),
            )
        ).all()
    )
    assert len(drafts) == 1
    refreshed = route_db.scalar(select(AstAsset).where(AstAsset.id == asset.id))
    assert refreshed is not None
    assert refreshed.status == "active"
    assert refreshed.operational_status == "READY_TO_MOVE"
    assert refreshed.branch_id == asset.branch_id


def test_create_rejects_invalid_asset(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    patches = _create_side_channel_patches(route_ids["company_id"])
    with _authed_client(route_db, ctx) as client, patches[0], patches[1], patches[2]:
        response = client.post(
            BASE,
            json={
                "branch_id": str(route_ids["branch_id"]),
                "asset_id": str(uuid4()),
                "to_location_label": "Dest",
            },
        )
    assert response.status_code == 404


def test_create_rejects_cross_tenant_asset(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids, tenant_id=route_ids["other_tenant_id"])
    patches = _create_side_channel_patches(route_ids["company_id"])
    with _authed_client(route_db, ctx) as client, patches[0], patches[1], patches[2]:
        response = client.post(
            BASE,
            json={
                "branch_id": str(asset.branch_id),
                "asset_id": str(asset.id),
                "to_location_label": "Dest",
            },
        )
    assert response.status_code == 404


def test_create_rejects_non_transferable_asset(
    route_db: Session, route_ids: dict[str, object]
) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids, status="draft")
    patches = _create_side_channel_patches(route_ids["company_id"])
    with _authed_client(route_db, ctx) as client, patches[0], patches[1], patches[2]:
        response = client.post(
            BASE,
            json={
                "branch_id": str(asset.branch_id),
                "asset_id": str(asset.id),
                "to_location_label": "Dest",
            },
        )
    assert response.status_code in {400, 422}


def test_create_rejects_missing_destination(route_db: Session, route_ids: dict[str, object]) -> None:
    ctx = _ctx(route_ids)
    asset = _insert_asset(route_db, route_ids)
    patches = _create_side_channel_patches(route_ids["company_id"])
    with _authed_client(route_db, ctx) as client, patches[0], patches[1], patches[2]:
        response = client.post(
            BASE,
            json={
                "branch_id": str(asset.branch_id),
                "asset_id": str(asset.id),
            },
        )
    assert response.status_code in {400, 422}
