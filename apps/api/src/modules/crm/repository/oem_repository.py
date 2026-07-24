"""CRM Oem repository."""

from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from modules.crm.models.oem import CrmOem
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class OemRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmOem | None:
        stmt = select(CrmOem).where(CrmOem.id == row_id, CrmOem.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmOem, ctx)
        return self.db.scalar(stmt)

    def find_by_name(self, ctx: TenantContext, company_id: UUID, oem_name: str) -> CrmOem | None:
        stmt = select(CrmOem).where(
            CrmOem.company_id == company_id,
            CrmOem.is_deleted.is_(False),
            func.lower(CrmOem.oem_name) == oem_name.strip().lower(),
        )
        stmt = self.apply_crm_filter(stmt, CrmOem, ctx)
        return self.db.scalar(stmt)

    def list_oems(self, ctx: TenantContext, company_id: UUID):
        stmt = select(CrmOem).where(
            CrmOem.company_id == company_id,
            CrmOem.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmOem, ctx)
        stmt = stmt.order_by(CrmOem.oem_name.asc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmOem:
        row = CrmOem(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmOem | None:
        row = self.get(ctx, row_id)
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
