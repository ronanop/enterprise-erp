"""Quality incoming inspection repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmIncomingInspection, QmIncomingInspectionLine
from modules.quality.repository.base import QmScopedRepository, utcnow


class IncomingInspectionRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, inspection_id: UUID) -> QmIncomingInspection | None:
        stmt = (
            select(QmIncomingInspection)
            .options(selectinload(QmIncomingInspection.lines))
            .where(
                QmIncomingInspection.id == inspection_id,
                QmIncomingInspection.is_deleted.is_(False),
            )
        )
        stmt = self.apply_qm_filter(stmt, QmIncomingInspection, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_inspections(self, ctx: TenantContext, company_id: UUID):
        stmt = (
            select(QmIncomingInspection)
            .options(selectinload(QmIncomingInspection.lines))
            .where(
                QmIncomingInspection.company_id == company_id,
                QmIncomingInspection.is_deleted.is_(False),
            )
        )
        stmt = self.apply_qm_filter(stmt, QmIncomingInspection, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmIncomingInspection:
        row = QmIncomingInspection(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def add_line(
        self, ctx: TenantContext, inspection: QmIncomingInspection, **fields
    ) -> QmIncomingInspectionLine:
        line = QmIncomingInspectionLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            company_id=inspection.company_id,
            branch_id=inspection.branch_id,
            incoming_inspection_id=inspection.id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(line)
        self.db.flush()
        return line

    def update(
        self, ctx: TenantContext, inspection_id: UUID, **fields
    ) -> QmIncomingInspection | None:
        row = self.get(ctx, inspection_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
