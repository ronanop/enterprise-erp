"""Optimistic locking for asset report snapshots (FP-ASSET-018)."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_report import AstAssetReport
from modules.asset.repository.asset_report_repository import AssetReportRepository
from modules.foundation.domain.value_objects import TenantContext


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
    AstAssetReport.__table__.create(bind=engine, checkfirst=True)
    session: Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    ctx = TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )
    now = datetime.now(timezone.utc)
    row = AstAssetReport(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        report_code="ARPT-2026-000001",
        report_type="register",
        status="draft",
        metrics_json={"report_key": "asset_summary"},
        is_deleted=False,
        version=2,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    session.add(row)
    session.flush()

    with pytest.raises(ConflictException, match="modified by another user"):
        AssetReportRepository(session).update(ctx, row.id, status="finalized", version=1)

    session.close()
    raw.dispose()
