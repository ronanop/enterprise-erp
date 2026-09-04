"""Asset component optimistic-locking tests (FP-ASSET-019)."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_component import AstAssetComponent
from modules.asset.repository.asset_component_repository import AssetComponentRepository
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_repository_rejects_stale_version() -> None:
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

    engine = raw.execution_options(schema_translate_map={"asset": None, "foundation": None})
    AstAssetComponent.__table__.create(bind=engine, checkfirst=True)
    session: Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    ctx = _ctx()
    now = datetime.now(timezone.utc)
    row = AstAssetComponent(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        asset_id=uuid4(),
        component_code="CMP-1",
        component_name="Motor",
        quantity=Decimal("1"),
        status="active",
        is_deleted=False,
        version=3,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    session.add(row)
    session.flush()

    with pytest.raises(ConflictException, match="modified by another user"):
        AssetComponentRepository(session).update(ctx, row.id, status="disposed", version=2)

    session.close()
    raw.dispose()


def test_search_and_list_by_asset() -> None:
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

    engine = raw.execution_options(schema_translate_map={"asset": None, "foundation": None})
    AstAssetComponent.__table__.create(bind=engine, checkfirst=True)
    session: Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    ctx = _ctx()
    now = datetime.now(timezone.utc)
    asset_id = uuid4()
    for code, status in [("A", "active"), ("B", "replaced"), ("C", "active")]:
        session.add(
            AstAssetComponent(
                id=uuid4(),
                tenant_id=ctx.tenant_id,
                company_id=ctx.company_id,
                branch_id=ctx.branch_id,
                asset_id=asset_id,
                component_code=code,
                component_name=f"Part {code}",
                status=status,
                is_deleted=False,
                version=1,
                created_at=now,
                updated_at=now,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
        )
    session.flush()
    repo = AssetComponentRepository(session)
    from modules.asset.repository.asset_component_repository import AssetComponentListFilters

    items, total = repo.search(
        ctx,
        AssetComponentListFilters(company_id=ctx.company_id, asset_id=asset_id, status="active"),
        offset=0,
        limit=25,
    )
    assert total == 2
    assert all(i.status == "active" for i in items)

    by_asset = repo.list_by_asset(ctx, asset_id, include_inactive=True)
    assert len(by_asset) == 3

    history = repo.list_code_history(ctx, asset_id=asset_id, component_code="A")
    assert len(history) == 1

    session.close()
    raw.dispose()
