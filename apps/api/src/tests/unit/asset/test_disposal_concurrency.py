"""Disposal concurrency and optimistic locking tests."""

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.repository.asset_disposal_repository import AssetDisposalRepository
from modules.asset.service.disposal_validator import DisposalValidator
from modules.foundation.domain.value_objects import TenantContext
from modules.foundation.models.workflow import WfInstance


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
    WfInstance.__table__.create(bind=engine, checkfirst=True)
    AstAssetDisposal.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetDisposal(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="ADISP-2026-000001",
        asset_id=uuid4(),
        disposal_type="scrap",
        disposal_date=date.today(),
        book_value_at_disposal=Decimal("100.0000"),
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

    repo = AssetDisposalRepository(session)
    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, proceeds_amount=None, version=2)
    session.close()
    raw.dispose()


def test_open_disposal_exclusivity_allows_exclude_self() -> None:
    validator = DisposalValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        operational_status="PENDING_DISPOSAL",
    )
    row = SimpleNamespace(
        id=uuid4(),
        asset_id=asset.id,
        status="draft",
        disposal_type="scrap",
        disposal_date=date.today(),
        proceeds_amount=None,
        book_value_at_disposal=None,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._disposals, "find_pending_for_asset", return_value=None) as find:
            with patch.object(validator._maintenances, "find_open_for_asset", return_value=None):
                with patch.object(
                    validator._assignments,
                    "find_pending_or_active_for_asset",
                    return_value=None,
                ):
                    with patch.object(
                        validator._transfers, "find_pending_for_asset", return_value=None
                    ):
                        validator.validate_update_fields(ctx, row, {"disposal_type": "sale"})
                        find.assert_called_once_with(ctx, asset.id, exclude_id=row.id)


def test_concurrent_post_claim_blocks_second_before_finance() -> None:
    """First post claims version; second claim with stale version never reaches Finance."""
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
    WfInstance.__table__.create(bind=engine, checkfirst=True)
    AstAssetDisposal.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetDisposal(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="ADISP-2026-000099",
        asset_id=uuid4(),
        disposal_type="scrap",
        disposal_date=date.today(),
        book_value_at_disposal=Decimal("100.0000"),
        status="approved",
        finance_journal_id=None,
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    session.add(row)
    session.flush()

    repo = AssetDisposalRepository(session)
    claimed = repo.update(ctx, row.id, version=1)
    assert claimed is not None
    assert int(claimed.version) == 2

    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, version=1)

    session.close()
    raw.dispose()
