"""Asset document optimistic-locking tests (FP-ASSET-016)."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_document import AstAssetDocument
from modules.asset.repository.asset_document_repository import AssetDocumentRepository
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
    AstAssetDocument.__table__.create(bind=engine, checkfirst=True)
    session: Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    ctx = _ctx()
    now = datetime.now(timezone.utc)
    row = AstAssetDocument(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        asset_id=uuid4(),
        document_type="invoice",
        document_name="INV-1",
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
        AssetDocumentRepository(session).update(ctx, row.id, status="superseded", version=2)

    session.close()
    raw.dispose()
