"""CRM CrmQuote / CrmQuoteLine repositories."""

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from modules.crm.models import CrmQuote, CrmQuoteLine
from modules.crm.repository.base import CrmScopedRepository, utcnow
from modules.foundation.domain.value_objects import TenantContext


class QuoteRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmQuote | None:
        stmt = select(CrmQuote).where(CrmQuote.id == row_id, CrmQuote.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmQuote, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_quotes(
        self,
        ctx: TenantContext,
        company_id: UUID,
        *,
        opportunity_id: UUID | None = None,
    ):
        stmt = select(CrmQuote).where(
            CrmQuote.company_id == company_id,
            CrmQuote.is_deleted.is_(False),
        )
        if opportunity_id is not None:
            stmt = stmt.where(CrmQuote.opportunity_id == opportunity_id)
        stmt = self.apply_crm_filter(stmt, CrmQuote, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmQuote:
        row = CrmQuote(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmQuote | None:
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


class QuoteLineRepository(CrmScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get(self, ctx: TenantContext, row_id: UUID) -> CrmQuoteLine | None:
        stmt = select(CrmQuoteLine).where(CrmQuoteLine.id == row_id, CrmQuoteLine.is_deleted.is_(False))
        stmt = self.apply_crm_filter(stmt, CrmQuoteLine, ctx, branch_scoped=True)
        return self.db.scalar(stmt)

    def list_for_quote(self, ctx: TenantContext, quote_id: UUID):
        stmt = select(CrmQuoteLine).where(
            CrmQuoteLine.quote_id == quote_id,
            CrmQuoteLine.is_deleted.is_(False),
        ).order_by(CrmQuoteLine.line_no)
        stmt = self.apply_crm_filter(stmt, CrmQuoteLine, ctx, branch_scoped=True)
        return list(self.db.scalars(stmt).all())

    def create(self, ctx: TenantContext, **fields) -> CrmQuoteLine:
        row = CrmQuoteLine(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update(self, ctx: TenantContext, row_id: UUID, **fields) -> CrmQuoteLine | None:
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

    def delete(self, ctx: TenantContext, row_id: UUID) -> bool:
        row = self.get(ctx, row_id)
        if row is None:
            return False
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        self.db.flush()
        return True
