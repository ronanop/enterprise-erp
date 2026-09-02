"""Depreciation concurrency / optimistic locking tests."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_depreciation import AstAssetDepreciation
from modules.asset.repository.asset_depreciation_repository import AssetDepreciationRepository
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
    AstAssetDepreciation.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetDepreciation(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="ADEP-2026-000001",
        asset_id=uuid4(),
        period_year=2026,
        period_month=7,
        method="straight_line",
        depreciation_amount=Decimal("100"),
        idempotency_key="k1",
        status="draft",
        is_deleted=False,
        version=3,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    session.add(row)
    session.flush()
    repo = AssetDepreciationRepository(session)
    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, units_produced=None, version=2)
    session.close()
    raw.dispose()


def test_concurrent_reverse_claim_blocks_second_before_finance() -> None:
    """First reverse claims version; second claim with stale version never reaches Finance."""
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
    AstAssetDepreciation.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetDepreciation(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="ADEP-2026-000099",
        asset_id=uuid4(),
        period_year=2026,
        period_month=7,
        method="straight_line",
        depreciation_amount=Decimal("100.0000"),
        book_value_after=Decimal("900.0000"),
        idempotency_key="k-rev",
        finance_journal_id=uuid4(),
        status="posted",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    session.add(row)
    session.flush()

    repo = AssetDepreciationRepository(session)
    claimed = repo.update(ctx, row.id, version=1)
    assert claimed is not None
    assert int(claimed.version) == 2

    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, version=1)

    session.close()
    raw.dispose()
