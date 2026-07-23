"""CRM CrmContact repository."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmContact
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class ContactRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmContact | None:
        stmt = select(CrmContact).where(CrmContact.id == row_id, CrmContact.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmContact, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_contacts(self, ctx: TenantContext, company_id: UUID, company_account_id: UUID | None = None):
        stmt = select(CrmContact).where(
            CrmContact.company_id == company_id,
            CrmContact.is_deleted.is_(False),
        )
        if company_account_id is not None:
            stmt = stmt.where(CrmContact.company_account_id == company_account_id)
        stmt = self.apply_crm_filter(stmt, CrmContact, ctx, branch_scoped=True)
        stmt = stmt.order_by(CrmContact.created_at.desc())
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmContact:
        row = CrmContact(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmContact | None:
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
