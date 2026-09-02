"""Integration fixtures for asset workflow governance (SQLite + real WorkflowService)."""

from __future__ import annotations

from collections.abc import Generator
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy import JSON, create_engine, event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(_type, compiler, **_kw):  # noqa: ANN001
    return compiler.visit_JSON(JSON())

from modules.asset.domain.workflow_codes import (
    ENTITY_AST_ASSET,
    ENTITY_AST_ASSIGNMENT,
    ENTITY_AST_DISPOSAL,
    ENTITY_AST_MAINTENANCE,
    ENTITY_AST_REVALUATION,
    ENTITY_AST_TRANSFER,
)
from modules.asset.models.asset import AstAsset
from modules.asset.models.asset_assignment import AstAssetAssignment
from modules.asset.models.asset_category import AstAssetCategory
from modules.asset.models.asset_disposal import AstAssetDisposal
from modules.asset.models.asset_location import AstAssetLocation
from modules.asset.models.asset_maintenance import AstAssetMaintenance
from modules.asset.models.asset_revaluation import AstAssetRevaluation
from modules.asset.models.asset_service_history import AstAssetServiceHistory
from modules.asset.models.asset_transfer import AstAssetTransfer
from modules.asset.models.assignment_component import AstAssignmentComponent
from modules.asset.models.dc_challan import AstDcChallan
from modules.foundation.models.workflow import WfAction, WfDefinition, WfInstance, WfStep
from modules.foundation.service.workflow_service import WorkflowService


# Mirror 0266_seed_asset_workflows AST_ASSET_APPROVAL steps
AST_ASSET_APPROVAL_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_EXECUTIVE", "Asset Executive Submit", "role"),
    (2, "ASSET_MANAGER", "Asset Manager Approval", "role"),
    (3, "ASSET_ADMIN", "Finance Capitalization Review", "role"),
]

AST_TRANSFER_APPROVAL_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_EXECUTIVE", "Transfer Request Submit", "role"),
    (2, "ASSET_MANAGER", "Operational Approval", "role"),
    (3, "ASSET_ADMIN", "Asset Control Approval", "role"),
]

AST_ASSIGNMENT_APPROVAL_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_EXECUTIVE", "Requestor Submit", "role"),
    (2, "ASSET_MANAGER", "Custodian Manager Approval", "role"),
    (3, "ASSET_MANAGER", "Asset Manager Approval", "role"),
]

AST_MAINTENANCE_APPROVAL_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_EXECUTIVE", "Technician / Executive Submit", "role"),
    (2, "ASSET_MANAGER", "Asset Manager Approval", "role"),
]

AST_DISPOSAL_APPROVAL_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_MANAGER", "Asset Manager Submit", "role"),
    (2, "ASSET_ADMIN", "Asset Admin Approval", "role"),
    (3, "ASSET_ADMIN", "Finance Review", "role"),
]

AST_REVALUATION_APPROVAL_STEPS: list[tuple[int, str, str, str]] = [
    (1, "ASSET_MANAGER", "Asset Manager Submit", "role"),
    (2, "ASSET_ADMIN", "Asset Admin Approval", "role"),
    (3, "ASSET_ADMIN", "Finance Review", "role"),
]


@pytest.fixture
def wf_db() -> Generator[Session, None, None]:
    """In-memory SQLite with real foundation workflow + asset register tables.

    WorkflowService runs against real tables (not mocked). Foreign keys are
    disabled so tenant/org/master FKs are not required for governance tests.
    """
    raw = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(raw, "connect")
    def _fk_off(dbapi_conn, _connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.close()

    engine = raw.execution_options(
        schema_translate_map={"foundation": None, "asset": None, "audit": None}
    )

    tables = [
        WfDefinition.__table__,
        WfStep.__table__,
        WfInstance.__table__,
        WfAction.__table__,
        AstAsset.__table__,
        AstAssetCategory.__table__,
        AstAssetTransfer.__table__,
        AstAssetAssignment.__table__,
        AstDcChallan.__table__,
        AstAssignmentComponent.__table__,
        AstAssetMaintenance.__table__,
        AstAssetServiceHistory.__table__,
        AstAssetLocation.__table__,
        AstAssetDisposal.__table__,
        AstAssetRevaluation.__table__,
    ]
    for table in tables:
        table.create(bind=engine, checkfirst=True)

    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
        session.rollback()
    finally:
        session.close()
        raw.dispose()


@pytest.fixture
def tenant_ids() -> dict[str, UUID]:
    return {
        "tenant_id": uuid4(),
        "company_id": uuid4(),
        "branch_id": uuid4(),
        "creator_id": uuid4(),
        "approver_id": uuid4(),
        "category_id": uuid4(),
    }


def seed_ast_asset_approval(db: Session, tenant_id: UUID, created_by: UUID) -> UUID:
    """Seed AST_ASSET_APPROVAL definition matching migration 0266 (3 steps)."""
    wf = WorkflowService(db)
    with patch(
        "modules.foundation.service.workflow_service.AuditService.log_entity_change",
        return_value=None,
    ):
        definition = wf.create_definition(
            tenant_id=tenant_id,
            workflow_code="AST_ASSET_APPROVAL",
            workflow_name="Asset Approval",
            module="asset",
            document_type=ENTITY_AST_ASSET,
            created_by=created_by,
        )
        for step_order, step_code, step_name, approver_type in AST_ASSET_APPROVAL_STEPS:
            wf.add_step(
                tenant_id=tenant_id,
                workflow_id=definition.id,
                step_order=step_order,
                step_code=step_code,
                step_name=step_name,
                approver_type=approver_type,
                created_by=created_by,
            )
    return definition.id


def seed_ast_transfer_approval(db: Session, tenant_id: UUID, created_by: UUID) -> UUID:
    """Seed AST_TRANSFER_APPROVAL definition matching FP-ASSET-002."""
    wf = WorkflowService(db)
    with patch(
        "modules.foundation.service.workflow_service.AuditService.log_entity_change",
        return_value=None,
    ):
        definition = wf.create_definition(
            tenant_id=tenant_id,
            workflow_code="AST_TRANSFER_APPROVAL",
            workflow_name="Asset Transfer Approval",
            module="asset",
            document_type=ENTITY_AST_TRANSFER,
            created_by=created_by,
        )
        for step_order, step_code, step_name, approver_type in AST_TRANSFER_APPROVAL_STEPS:
            wf.add_step(
                tenant_id=tenant_id,
                workflow_id=definition.id,
                step_order=step_order,
                step_code=step_code,
                step_name=step_name,
                approver_type=approver_type,
                created_by=created_by,
            )
    return definition.id


def seed_ast_assignment_approval(db: Session, tenant_id: UUID, created_by: UUID) -> UUID:
    """Seed AST_ASSIGNMENT_APPROVAL definition matching migration 0266."""
    wf = WorkflowService(db)
    with patch(
        "modules.foundation.service.workflow_service.AuditService.log_entity_change",
        return_value=None,
    ):
        definition = wf.create_definition(
            tenant_id=tenant_id,
            workflow_code="AST_ASSIGNMENT_APPROVAL",
            workflow_name="Asset Assignment Approval",
            module="asset",
            document_type=ENTITY_AST_ASSIGNMENT,
            created_by=created_by,
        )
        for step_order, step_code, step_name, approver_type in AST_ASSIGNMENT_APPROVAL_STEPS:
            wf.add_step(
                tenant_id=tenant_id,
                workflow_id=definition.id,
                step_order=step_order,
                step_code=step_code,
                step_name=step_name,
                approver_type=approver_type,
                created_by=created_by,
            )
    return definition.id


def seed_ast_maintenance_approval(db: Session, tenant_id: UUID, created_by: UUID) -> UUID:
    """Seed AST_MAINTENANCE_APPROVAL definition matching migration 0266."""
    wf = WorkflowService(db)
    with patch(
        "modules.foundation.service.workflow_service.AuditService.log_entity_change",
        return_value=None,
    ):
        definition = wf.create_definition(
            tenant_id=tenant_id,
            workflow_code="AST_MAINTENANCE_APPROVAL",
            workflow_name="Asset Maintenance Approval",
            module="asset",
            document_type=ENTITY_AST_MAINTENANCE,
            created_by=created_by,
        )
        for step_order, step_code, step_name, approver_type in AST_MAINTENANCE_APPROVAL_STEPS:
            wf.add_step(
                tenant_id=tenant_id,
                workflow_id=definition.id,
                step_order=step_order,
                step_code=step_code,
                step_name=step_name,
                approver_type=approver_type,
                created_by=created_by,
            )
    return definition.id


def seed_ast_disposal_approval(db: Session, tenant_id: UUID, created_by: UUID) -> UUID:
    """Seed AST_DISPOSAL_APPROVAL definition matching migration 0266."""
    wf = WorkflowService(db)
    with patch(
        "modules.foundation.service.workflow_service.AuditService.log_entity_change",
        return_value=None,
    ):
        definition = wf.create_definition(
            tenant_id=tenant_id,
            workflow_code="AST_DISPOSAL_APPROVAL",
            workflow_name="Asset Disposal Approval",
            module="asset",
            document_type=ENTITY_AST_DISPOSAL,
            created_by=created_by,
        )
        for step_order, step_code, step_name, approver_type in AST_DISPOSAL_APPROVAL_STEPS:
            wf.add_step(
                tenant_id=tenant_id,
                workflow_id=definition.id,
                step_order=step_order,
                step_code=step_code,
                step_name=step_name,
                approver_type=approver_type,
                created_by=created_by,
            )
    return definition.id


def seed_ast_revaluation_approval(db: Session, tenant_id: UUID, created_by: UUID) -> UUID:
    """Seed AST_REVALUATION_APPROVAL definition matching FP-ASSET-007."""
    wf = WorkflowService(db)
    with patch(
        "modules.foundation.service.workflow_service.AuditService.log_entity_change",
        return_value=None,
    ):
        definition = wf.create_definition(
            tenant_id=tenant_id,
            workflow_code="AST_REVALUATION_APPROVAL",
            workflow_name="Asset Revaluation Approval",
            module="asset",
            document_type=ENTITY_AST_REVALUATION,
            created_by=created_by,
        )
        for step_order, step_code, step_name, approver_type in AST_REVALUATION_APPROVAL_STEPS:
            wf.add_step(
                tenant_id=tenant_id,
                workflow_id=definition.id,
                step_order=step_order,
                step_code=step_code,
                step_name=step_name,
                approver_type=approver_type,
                created_by=created_by,
            )
    return definition.id


def insert_draft_asset(db: Session, ids: dict[str, UUID]) -> AstAsset:
    now = datetime.now(timezone.utc)
    category = AstAssetCategory(
        id=ids["category_id"],
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        category_code="IT",
        category_name="IT Assets",
        status="active",
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["creator_id"],
        updated_by=ids["creator_id"],
    )
    db.merge(category)
    code = f"AST-TEST-{uuid4().hex[:8]}"
    row = AstAsset(
        id=uuid4(),
        tenant_id=ids["tenant_id"],
        company_id=ids["company_id"],
        branch_id=ids["branch_id"],
        document_number=code,
        asset_code=code,
        asset_name="WF Integration Asset",
        asset_category_id=ids["category_id"],
        asset_type="fixed",
        status="draft",
        purchase_date=date.today(),
        purchase_cost=Decimal("1000.0000"),
        currency_code="USD",
        is_shared=False,
        is_deleted=False,
        version=1,
        created_at=now,
        updated_at=now,
        created_by=ids["creator_id"],
        updated_by=ids["creator_id"],
    )
    db.add(row)
    db.flush()
    return row


def insert_active_asset(
    db: Session,
    ids: dict[str, UUID],
    *,
    operational_status: str = "READY_TO_MOVE",
) -> AstAsset:
    row = insert_draft_asset(db, ids)
    row.status = "active"
    row.department_id = uuid4()
    row.custodian_employee_id = uuid4()
    row.operational_status = operational_status
    db.flush()
    return row


def count_wf_instances(db: Session, tenant_id: UUID, entity_id: UUID) -> int:
    stmt = select(WfInstance).where(
        WfInstance.tenant_id == tenant_id,
        WfInstance.entity_id == entity_id,
    )
    return len(list(db.scalars(stmt).all()))
