"""Quality defect repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.foundation.domain.value_objects import TenantContext
from modules.quality.models import QmDefect
from modules.quality.repository.base import QmScopedRepository, utcnow


class DefectRepository(QmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, defect_id: UUID) -> QmDefect | None:
        stmt = select(QmDefect).where(QmDefect.id == defect_id, QmDefect.is_deleted.is_(False))
        stmt = self.apply_qm_filter(stmt, QmDefect, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_defects(self, ctx: TenantContext, company_id: UUID, ncr_id: UUID | None = None):
        stmt = select(QmDefect).where(
            QmDefect.company_id == company_id,
            QmDefect.is_deleted.is_(False),
        )
        if ncr_id is not None:
            stmt = stmt.where(QmDefect.ncr_id == ncr_id)
        stmt = self.apply_qm_filter(stmt, QmDefect, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> QmDefect:
        row = QmDefect(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, defect_id: UUID, **fields) -> QmDefect | None:
        row = self.get(ctx, defect_id)
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
