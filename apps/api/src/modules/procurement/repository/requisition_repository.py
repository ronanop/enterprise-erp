"""Procurement requisition repository."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.procurement.models.requisition import ProcRequisitionHeader, ProcRequisitionLine
from modules.procurement.repository.base import ProcScopedRepository


class RequisitionRepository(ProcScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def list_requisitions(self, ctx: TenantContext, company_id: UUID | None):
        stmt = select(ProcRequisitionHeader).where(
            ProcRequisitionHeader.is_deleted.is_(False)
        )
        stmt = self.apply_optional_company_filter(stmt, ProcRequisitionHeader, company_id)
        stmt = self.apply_proc_filter(stmt, ProcRequisitionHeader, ctx)
        return self.db.execute(stmt).scalars().all()

    def get_requisition(self, ctx: TenantContext, requisition_id: UUID):
        stmt = (
            select(ProcRequisitionHeader)
            .options(selectinload(ProcRequisitionHeader.lines))
            .where(
                ProcRequisitionHeader.id == requisition_id,
                ProcRequisitionHeader.is_deleted.is_(False),
            )
        )
        stmt = self.apply_proc_filter(stmt, ProcRequisitionHeader, ctx)
        return self.db.execute(stmt).scalar_one_or_none()

    def create_requisition(self, ctx: TenantContext, **kwargs) -> ProcRequisitionHeader:
        now = datetime.now(timezone.utc)
        row = ProcRequisitionHeader(
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            created_at=now,
            updated_at=now,
            **kwargs,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_requisition(self, ctx: TenantContext, requisition_id: UUID, **kwargs):
        row = self.get_requisition(ctx, requisition_id)
        if row is None:
            return None
        for k, v in kwargs.items():
            setattr(row, k, v)
        row.updated_by = ctx.user_id
        row.updated_at = datetime.now(timezone.utc)
        row.version = (row.version or 1) + 1
        self.db.flush()
        return row

    def add_line(self, ctx: TenantContext, requisition_id: UUID, **kwargs) -> ProcRequisitionLine:
        now = datetime.now(timezone.utc)
        line = ProcRequisitionLine(
            requisition_header_id=requisition_id,
            tenant_id=ctx.tenant_id,
            company_id=kwargs.pop("company_id", None),
            branch_id=kwargs.pop("branch_id", None),
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            created_at=now,
            updated_at=now,
            **kwargs,
        )
        self.db.add(line)
        self.db.flush()
        return line

    def delete_requisition(self, ctx: TenantContext, requisition_id: UUID) -> None:
        row = self.get_requisition(ctx, requisition_id)
        if row:
            row.is_deleted = True
            row.deleted_at = datetime.now(timezone.utc)
            row.deleted_by = ctx.user_id
            self.db.flush()
