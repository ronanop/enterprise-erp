"""Marketing scoped repository base."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.exceptions import ForbiddenException
from modules.foundation.domain.value_objects import TenantContext
from modules.organization.repository.base import OrgScopedRepository


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MktScopedRepository(OrgScopedRepository):
    def __init__(self, db: Session) -> None:
        super().__init__(db)

    @staticmethod
    def apply_mkt_filter(stmt, model, ctx: TenantContext, *, branch_scoped: bool = False):
        stmt = MktScopedRepository.apply_tenant_filter(stmt, model, ctx)
        if ctx.company_id and ctx.user_type not in {"super_admin", "tenant_admin"}:
            stmt = stmt.where(model.company_id == ctx.company_id)
        if (
            branch_scoped
            and ctx.branch_id
            and ctx.user_type not in {"super_admin", "tenant_admin"}
            and hasattr(model, "branch_id")
        ):
            stmt = stmt.where(model.branch_id == ctx.branch_id)
        return stmt

    @staticmethod
    def resolve_company_id(ctx: TenantContext, company_id: UUID | None) -> UUID:
        if company_id is not None:
            MktScopedRepository.ensure_company_access(ctx, company_id)
            return company_id
        if ctx.company_id is None:
            raise ForbiddenException("Company context required")
        return ctx.company_id

    def get_by_id(self, model, ctx: TenantContext, row_id: UUID, *, branch_scoped: bool = False):
        stmt = select(model).where(model.id == row_id, model.is_deleted.is_(False))
        stmt = self.apply_mkt_filter(stmt, model, ctx, branch_scoped=branch_scoped)
        return self.db.scalar(stmt)

    def list_by_company(self, model, ctx: TenantContext, company_id: UUID, *, branch_scoped: bool = False):
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
        for k, v in fields.items():
            if v is not None:
                setattr(row, k, v)
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
