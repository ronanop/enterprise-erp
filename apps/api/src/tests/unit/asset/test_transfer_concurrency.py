"""Transfer concurrency and optimistic locking tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.domain.exceptions import TransferValidationError
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.repository.asset_transfer_repository import AssetTransferRepository
from modules.asset.service.transfer_validator import TransferValidator
from modules.foundation.models.workflow import WfInstance
from modules.foundation.domain.value_objects import TenantContext


def _ctx() -> TenantContext:
    return TenantContext(
        tenant_id=uuid4(),
        user_id=uuid4(),
        user_type="employee",
        company_id=uuid4(),
        branch_id=uuid4(),
    )


def test_validator_blocks_second_pending_transfer() -> None:
    validator = TransferValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    pending = SimpleNamespace(document_number="ATRF-2026-000001")
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(
            validator._org,
            "get_branch",
            return_value=SimpleNamespace(company_id=ctx.company_id),
        ):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=pending):
                with pytest.raises(TransferValidationError, match="pending transfer"):
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={"asset_id": asset.id, "to_branch_id": uuid4()},
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
    AstAssetTransfer.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetTransfer(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="ATRF-2026-000001",
        asset_id=uuid4(),
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

    repo = AssetTransferRepository(session)
    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, reason="new", version=2)
    session.close()
    raw.dispose()
