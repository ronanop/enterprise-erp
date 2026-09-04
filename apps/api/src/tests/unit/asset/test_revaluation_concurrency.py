"""Revaluation concurrency and optimistic locking tests."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_revaluation import AstAssetRevaluation
from modules.asset.repository.asset_revaluation_repository import AssetRevaluationRepository
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(), user_id=uuid4(), user_type="employee",
        company_id=uuid4(), branch_id=uuid4(),
    )


def _session() -> tuple[Session, object]:
    raw = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(raw, "connect")
    def _fk_off(dbapi_conn, _record) -> None:  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    engine = raw.execution_options(schema_translate_map={"asset": None, "foundation": None})
    WfInstance.__table__.create(bind=engine, checkfirst=True)
    AstAssetRevaluation.__table__.create(bind=engine, checkfirst=True)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)(), raw


def _row(ctx: TenantContext, *, version: int = 1) -> AstAssetRevaluation:
    now = datetime.now(timezone.utc)
    return AstAssetRevaluation(
        id=uuid4(), tenant_id=ctx.tenant_id, company_id=ctx.company_id, branch_id=ctx.branch_id,
        document_number=f"AREV-TEST-{uuid4().hex[:8]}", asset_id=uuid4(),
        old_book_value=Decimal("100.0000"), new_book_value=Decimal("150.0000"),
        reason="market value", status="approved", is_deleted=False, version=version,
        created_at=now, updated_at=now, created_by=ctx.user_id, updated_by=ctx.user_id,
    )


def test_repository_rejects_stale_version() -> None:
    session, raw = _session()
    ctx = _ctx()
    row = _row(ctx, version=3)
    session.add(row)
    session.flush()
    with pytest.raises(ConflictException, match="modified by another user"):
        AssetRevaluationRepository(session).update(ctx, row.id, version=2)
    session.close()
    raw.dispose()


def test_concurrent_post_claim_blocks_second_before_finance() -> None:
    session, raw = _session()
    ctx = _ctx()
    row = _row(ctx)
    session.add(row)
    session.flush()
    repo = AssetRevaluationRepository(session)
    claimed = repo.update(ctx, row.id, version=1)
    assert claimed is not None
    assert int(claimed.version) == 2
    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, version=1)
    session.close()
    raw.dispose()
