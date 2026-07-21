"""CRM CrmProduct (quote/OVF line catalog) repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmProduct
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class ProductRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmProduct | None:
        stmt = select(CrmProduct).where(CrmProduct.id == row_id, CrmProduct.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmProduct, ctx)
        return self.db.scalar(stmt)

    def list_products(self, ctx: TenantContext, company_id: UUID):
        stmt = select(CrmProduct).where(
            CrmProduct.company_id == company_id,
            CrmProduct.is_deleted.is_(False),
        )
        stmt = self.apply_crm_filter(stmt, CrmProduct, ctx)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmProduct:
        row = CrmProduct(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmProduct | None:
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
