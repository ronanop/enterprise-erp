"""CRM CrmVisitLog repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmVisitLog
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class VisitLogRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmVisitLog | None:
        stmt = select(CrmVisitLog).where(CrmVisitLog.id == row_id, CrmVisitLog.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmVisitLog, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_logs(self, ctx: TenantContext, company_id: UUID):
        stmt = select(CrmVisitLog).where(
            CrmVisitLog.company_id == company_id,
            CrmVisitLog.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmVisitLog, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmVisitLog:
        row = CrmVisitLog(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmVisitLog | None:
        row = self.get(ctx, row_id)
        if row is None:
            return None
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
