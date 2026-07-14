"""CRM CrmInteraction repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmInteraction
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class InteractionRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmInteraction | None:
        stmt = select(CrmInteraction).where(CrmInteraction.id == row_id, CrmInteraction.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmInteraction, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_interactions(self, ctx: TenantContext, company_id: UUID):
        stmt = select(CrmInteraction).where(
            CrmInteraction.company_id == company_id,
            CrmInteraction.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmInteraction, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmInteraction:
        row = CrmInteraction(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmInteraction | None:
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
