"""CR-004 Phase 5A-1 — assignment data foundation tests."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_migration():
    path = (
        Path(__file__).resolve().parents[4]
        / "alembic"
        / "versions"
        / "0487_ast_assignment_data_foundation.py"
    )
    spec = spec_from_file_location("migration_0487", path)
    assert spec and spec.loader
    mod = module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


migration = _load_migration()
from core.exceptions import ConflictException
from modules.asset.domain.enums import (
    ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES,
    AssignmentDeliveryReferenceStatus,
)
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.repository.asset_assignment_repository import AssetAssignmentRepository
from modules.asset.schemas import AssetAssignmentCreate, AssetAssignmentResponse, AssetAssignmentUpdate
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


def _sqlite_session() -> tuple[Session, object]:
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
    return SessionLocal(), raw


def _draft_row(ctx: TenantContext, **overrides) -> AstAssetAssignment:
    now = datetime.now(timezone.utc)
    base = dict(
        id=uuid4(),
        tenant_id=ctx.tenant_id,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number=f"AASN-{uuid4().hex[:8]}",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        status="draft",
        delivery_reference_status="not_applicable",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ctx.user_id,
        updated_by=ctx.user_id,
    )
    base.update(overrides)
    return AstAssetAssignment(**base)


# --- Migration metadata ---


def test_migration_revision_chain() -> None:
    assert migration.revision == "0487_ast_assignment_data_foundation"
    assert migration.down_revision == "0486_ast_operational_status"


def test_migration_reference_statuses_locked() -> None:
    assert migration.REFERENCE_STATUSES == (
        "not_applicable",
        "pending",
        "issued",
        "received",
    )


def test_migration_targets_assignment_table() -> None:
    assert migration.SCHEMA == "asset"
    assert migration.TABLE == "ast_asset_assignment"
    assert migration.STATUS_CHECK == "ck_ast_asset_assignment_delivery_reference_status"


def test_migration_upgrade_downgrade_defined() -> None:
    assert callable(migration.upgrade)
    assert callable(migration.downgrade)


@pytest.mark.parametrize("status", migration.REFERENCE_STATUSES)
def test_domain_enum_matches_migration_status(status: str) -> None:
    assert status in ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES


def test_domain_enum_has_four_values() -> None:
    assert len(AssignmentDeliveryReferenceStatus) == 4


# --- ORM ---


def test_orm_maps_excel_foundation_columns() -> None:
    cols = {c.key for c in AstAssetAssignment.__table__.columns}
    assert "delivery_reference_number" in cols
    assert "delivery_reference_status" in cols
    assert "assignment_remarks" in cols
    assert "return_remarks" in cols


def test_orm_default_delivery_reference_status() -> None:
    row = _draft_row(_ctx())
    assert row.delivery_reference_status == "not_applicable"


def test_orm_delivery_reference_number_string_length() -> None:
    col = AstAssetAssignment.__table__.c.delivery_reference_number
    assert col.type.length == 100


def test_orm_optional_text_and_reference_number_nullable() -> None:
    row = _draft_row(_ctx())
    assert row.delivery_reference_number is None
    assert row.assignment_remarks is None
    assert row.return_remarks is None


# --- Schemas ---


def test_response_schema_includes_foundation_fields() -> None:
    props = AssetAssignmentResponse.model_json_schema()["properties"]
    for key in (
        "delivery_reference_number",
        "delivery_reference_status",
        "assignment_remarks",
        "return_remarks",
    ):
        assert key in props


def test_create_schema_accepts_foundation_fields() -> None:
    body = AssetAssignmentCreate(
        branch_id=uuid4(),
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        delivery_reference_number="DC-2026-001",
        delivery_reference_status="issued",
        assignment_remarks="Laptop bag included",
    )
    assert body.delivery_reference_number == "DC-2026-001"
    assert body.delivery_reference_status == "issued"


@pytest.mark.parametrize("status", migration.REFERENCE_STATUSES)
def test_create_schema_accepts_each_delivery_reference_status(status: str) -> None:
    body = AssetAssignmentCreate(
        branch_id=uuid4(),
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        delivery_reference_status=status,
    )
    assert body.delivery_reference_status == status


def test_update_schema_accepts_assignment_remarks() -> None:
    body = AssetAssignmentUpdate(version=2, assignment_remarks="Updated note")
    assert body.assignment_remarks == "Updated note"


def test_update_schema_accepts_delivery_reference_number() -> None:
    body = AssetAssignmentUpdate(version=1, delivery_reference_number="CH-77")
    assert body.delivery_reference_number == "CH-77"


def test_enum_values_cover_migration_statuses() -> None:
    for status in migration.REFERENCE_STATUSES:
        assert status in ASSIGNMENT_DELIVERY_REFERENCE_STATUS_VALUES


def test_repository_update_assignment_remarks_only() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = _draft_row(ctx, assignment_remarks="old")
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    updated = repo.update(ctx, row.id, assignment_remarks="new", version=1)
    assert updated is not None
    assert updated.assignment_remarks == "new"
    session.close()
    raw.dispose()


def test_return_request_schema_accepts_return_remarks() -> None:
    from modules.asset.schemas import AssetAssignmentReturnRequest

    body = AssetAssignmentReturnRequest(return_condition="good", return_remarks="Screen scratched")
    assert body.return_remarks == "Screen scratched"


def test_response_from_orm_row() -> None:
    ctx = _ctx()
    row = _draft_row(
        ctx,
        delivery_reference_number="REF-9",
        delivery_reference_status="pending",
        assignment_remarks="note",
        return_remarks="ret",
    )
    dto = AssetAssignmentResponse.model_validate(row)
    assert dto.delivery_reference_number == "REF-9"
    assert dto.delivery_reference_status == "pending"
    assert dto.assignment_remarks == "note"
    assert dto.return_remarks == "ret"


@pytest.mark.parametrize(
    "status",
    list(AssignmentDeliveryReferenceStatus),
)
def test_response_accepts_each_reference_status(status: AssignmentDeliveryReferenceStatus) -> None:
    ctx = _ctx()
    row = _draft_row(ctx, delivery_reference_status=status.value)
    dto = AssetAssignmentResponse.model_validate(row)
    assert dto.delivery_reference_status == status.value


# --- Repository ---


def test_repository_create_persists_foundation_fields() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    repo = AssetAssignmentRepository(session)
    row = repo.create(
        ctx,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-FOUND-1",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        status="draft",
        delivery_reference_number="CH-100",
        delivery_reference_status="issued",
        assignment_remarks="Issue remarks",
        return_remarks=None,
    )
    session.commit()
    loaded = session.get(AstAssetAssignment, row.id)
    assert loaded is not None
    assert loaded.delivery_reference_number == "CH-100"
    assert loaded.delivery_reference_status == "issued"
    assert loaded.assignment_remarks == "Issue remarks"
    assert loaded.return_remarks is None
    session.close()
    raw.dispose()


def test_repository_update_clears_nullable_foundation_fields() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = _draft_row(
        ctx,
        delivery_reference_number="X",
        assignment_remarks="Y",
        return_remarks="Z",
    )
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    updated = repo.update(
        ctx,
        row.id,
        delivery_reference_number=None,
        assignment_remarks=None,
        return_remarks=None,
        version=1,
    )
    assert updated is not None
    assert updated.delivery_reference_number is None
    assert updated.assignment_remarks is None
    assert updated.return_remarks is None
    session.close()
    raw.dispose()


def test_repository_persists_return_remarks_on_create() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    repo = AssetAssignmentRepository(session)
    row = repo.create(
        ctx,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number="AASN-RET-1",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        status="draft",
        return_remarks="Returned with charger",
    )
    session.flush()
    assert row.return_remarks == "Returned with charger"
    session.close()
    raw.dispose()


def test_repository_update_sets_return_remarks() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = _draft_row(ctx)
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    updated = repo.update(ctx, row.id, return_remarks="Minor wear", version=1)
    assert updated is not None
    assert updated.return_remarks == "Minor wear"
    session.close()
    raw.dispose()


def test_repository_get_includes_foundation_fields() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = _draft_row(
        ctx,
        delivery_reference_number="G-1",
        delivery_reference_status="received",
        assignment_remarks="am",
        return_remarks="rm",
    )
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    got = repo.get(ctx, row.id)
    assert got is not None
    assert got.delivery_reference_number == "G-1"
    assert got.delivery_reference_status == "received"
    assert got.assignment_remarks == "am"
    assert got.return_remarks == "rm"
    session.close()
    raw.dispose()


def test_repository_update_changes_reference_status() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = _draft_row(ctx, delivery_reference_status="pending")
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    updated = repo.update(ctx, row.id, delivery_reference_status="received", version=1)
    assert updated is not None
    assert updated.delivery_reference_status == "received"
    session.close()
    raw.dispose()


def test_repository_stale_version_on_foundation_update() -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    row = _draft_row(ctx, version=2)
    session.add(row)
    session.flush()
    repo = AssetAssignmentRepository(session)
    with pytest.raises(ConflictException):
        repo.update(ctx, row.id, assignment_remarks="nope", version=1)
    session.close()
    raw.dispose()


@pytest.mark.parametrize(
    ("number", "remarks"),
    [
        ("DC-1", "a"),
        ("DC-2", "b" * 100),
        (None, None),
        ("LONG-REF", "multi\nline"),
    ],
)
def test_repository_roundtrip_reference_and_remarks(number: str | None, remarks: str | None) -> None:
    session, raw = _sqlite_session()
    ctx = _ctx()
    repo = AssetAssignmentRepository(session)
    created = repo.create(
        ctx,
        company_id=ctx.company_id,
        branch_id=ctx.branch_id,
        document_number=f"AASN-{uuid4().hex[:6]}",
        asset_id=uuid4(),
        allocation_type="employee",
        employee_id=uuid4(),
        status="draft",
        delivery_reference_number=number,
        delivery_reference_status="pending" if number else "not_applicable",
        assignment_remarks=remarks,
    )
    session.flush()
    fetched = repo.get(ctx, created.id)
    assert fetched is not None
    assert fetched.delivery_reference_number == number
    assert fetched.assignment_remarks == remarks
    session.close()
    raw.dispose()


def test_sqlite_table_has_foundation_columns() -> None:
    session, raw = _sqlite_session()
    insp = inspect(session.bind)
    names = {c["name"] for c in insp.get_columns(AstAssetAssignment.__tablename__)}
    assert "delivery_reference_number" in names
    assert "delivery_reference_status" in names
    assert "assignment_remarks" in names
    assert "return_remarks" in names
    session.close()
    raw.dispose()


# OpenAPI smoke (schema surface only; router unchanged)


def test_openapi_assignment_response_documents_foundation_fields() -> None:
    from main import app

    schema = app.openapi()["components"]["schemas"]["AssetAssignmentResponse"]["properties"]
    assert "delivery_reference_number" in schema
    assert "delivery_reference_status" in schema
    assert "assignment_remarks" in schema
    assert "return_remarks" in schema
