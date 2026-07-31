"""Maintenance concurrency and optimistic locking tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from core.exceptions import ConflictException
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.repository.asset_maintenance_repository import AssetMaintenanceRepository
from modules.asset.service.maintenance_validator import MaintenanceValidator
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
    AstAssetMaintenance.__table__.create(bind=engine, checkfirst=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session: Session = SessionLocal()
    now = datetime.now(timezone.utc)
    ctx = _ctx()
    row = AstAssetMaintenance(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AMNT-2026-000001",
        asset_id=uuid4(),
        maintenance_type="preventive",
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

    repo = AssetMaintenanceRepository(session)
    with pytest.raises(ConflictException, match="modified by another user"):
        repo.update(ctx, row.id, cost_amount=None, version=2)
    session.close()
    raw.dispose()


def test_open_work_order_exclusivity_allows_exclude_self() -> None:
    validator = MaintenanceValidator(MagicMock())
    ctx = _ctx()
    asset = SimpleNamespace(id=uuid4(), company_id=ctx.company_id, status="active")
    row = SimpleNamespace(
        id=uuid4(),
        status="draft",
        asset_id=asset.id,
        maintenance_type="preventive",
        vendor_id=None,
        technician_employee_id=None,
        maintenance_plan_id=None,
        scheduled_date=None,
        cost_amount=None,
        company_id=ctx.company_id,
    )
    with patch.object(validator._assets, "get", return_value=asset):
        with patch.object(
            validator._maintenances, "find_open_for_asset", return_value=None
        ) as find_open:
            validator.validate_update_fields(ctx, row, {"maintenance_type": "corrective"})
            find_open.assert_called_once()
            assert find_open.call_args.kwargs["exclude_id"] == row.id
