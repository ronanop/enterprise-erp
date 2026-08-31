"""Assignment concurrency and optimistic locking tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.service.assignment_validator import AssignmentValidator
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
    AstAssetAssignment.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetAssignment(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-2026-000001",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        employee_source="MASTER_DATA",
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

    repo = AssetAssignmentRepository(session)
    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, expected_return_at=None, version=2)
    session.close()
    raw.dispose()


def test_shared_asset_allows_multiple_assignments() -> None:
    validator = AssignmentValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(
        id=uuid4(),
        company_id=ctx.company_id,
        status="active",
        operational_status="READY_TO_MOVE",
        is_shared=True,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(validator._master, "get_employee", return_value=MagicMock()):
            with patch.object(validator._transfers, "find_pending_for_asset", return_value=None):
                with patch.object(
                    validator._assignments,
                    "find_pending_or_active_for_asset",
                    return_value=SimpleNamespace(document_number="AASN-OTHER"),
                ) as find_pending:
                    validator.validate_create_fields(
                        ctx,
                        company_id=ctx.company_id,
                        fields={
                            "asset_id": asset.id,
                            "allocation_type": "employee",
                            "employee_id": uuid4(),
                        },
                    )
                    find_pending.assert_not_called()
