"""Marketing repository base utilities."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.org_data_scope import apply_org_scope_filter
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository

MODULE_KEY = "marketing"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MktScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_mkt_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = MktScopedRepository.apply_tenant_filter(stmt, model, ctx)
        return apply_org_scope_filter(
            stmt, model, ctx, module_key=MODULE_KEY, branch_scoped=branch_scoped
        )

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID:
        if company_id is not None:
            MktScopedRepository.ensure_company_access(ctx, company_id, module_key=MODULE_KEY)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id

    def get_by_id(self, model, ctx: TenantContext, row_id: UUID, *, branch_scoped: bool = False):
        stmt = select(model).where(model.id == row_id, model.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, model, ctx, branch_scoped=branch_scoped)
        return self.db.scalar(stmt)

    def list_by_company(
        self,
        model,
        ctx: TenantContext,
        company_id: UUID,
        *,
        branch_scoped: bool = False,
    ):
        stmt = select(model).where(model.company_id == company_id, model.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, model, ctx, branch_scoped=branch_scoped)
        return list(self.db.scalars(stmt).all())

    def create_row(self, model, ctx: TenantContext, **fields):
        row = model(
            id=uuid4(),
            tenant_id=ctx.tenant_id,
            created_by=ctx.user_id,
            updated_by=ctx.user_id,
            **fields,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_row(self, model, ctx: TenantContext, row_id: UUID, **fields):
        row = self.get_by_id(model, ctx, row_id)
        if row is None:
            return None
        for key, value in fields.items():
            if value is not None:
                setattr(row, key, value)
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row

    def soft_delete_row(self, model, ctx: TenantContext, row_id: UUID):
        row = self.get_by_id(model, ctx, row_id)
        if row is None:
            return None
        row.is_deleted = True
        row.deleted_at = utcnow()
        row.deleted_by = ctx.user_id
        row.updated_at = utcnow()
        row.updated_by = ctx.user_id
        if hasattr(row, "version"):
            row.version = int(row.version or 1) + 1
        self.db.flush()
        return row
